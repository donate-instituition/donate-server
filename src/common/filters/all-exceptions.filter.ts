import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { env } from '../../config/env';
import { ErrorLogsService } from '../../domains/error-logs/error-logs.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

type ErrorResponseBody = {
  statusCode: number;
  message?: string | string[];
  error?: string;
  code?: string;
};

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'cpf',
  'cnpj',
  'password',
  'passwordHash',
  'refreshToken',
  'token',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      acc[key] = '[REDACTED]';
      return acc;
    }

    acc[key] = sanitize(entry);
    return acc;
  }, {});
}

function getStackLines(exception: unknown) {
  if (!(exception instanceof Error) || !exception.stack) {
    return [];
  }

  return exception.stack.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseSource(stackLines: string[]) {
  const sourceLine = stackLines.find((line) =>
    line.startsWith('at ') && (line.includes('/src/') || line.includes('/dist/')),
  );

  if (!sourceLine) {
    return {};
  }

  const match = sourceLine.match(/^at\s+(?:(?<method>.*?)\s+\()?((?<file>.*?):(?<line>\d+):(?<column>\d+))\)?$/);

  return {
    controllerMethod: match?.groups?.method,
    sourceFile: match?.groups?.file,
    sourceLine: match?.groups?.line ? Number(match.groups.line) : undefined,
    sourceColumn: match?.groups?.column ? Number(match.groups.column) : undefined,
  };
}

function getHttpExceptionBody(exception: HttpException): ErrorResponseBody {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return {
      statusCode: exception.getStatus(),
      message: response,
      error: exception.name,
    };
  }

  if (isPlainObject(response)) {
    return response as ErrorResponseBody;
  }

  return {
    statusCode: exception.getStatus(),
    message: exception.message,
    error: exception.name,
  };
}

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly errorLogsService: ErrorLogsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser>();
    const response = ctx.getResponse<Response>();
    const requestId = request.headers['x-request-id']?.toString() || randomUUID();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = isHttpException ? getHttpExceptionBody(exception) : undefined;
    const stack = getStackLines(exception);
    const source = parseSource(stack);
    const errorName = exception instanceof Error ? exception.name : 'UnknownException';
    const message =
      exceptionBody?.message ??
      (exception instanceof Error ? exception.message : 'Internal server error');
    const normalizedMessage = Array.isArray(message) ? message.join(' ') : message;
    const errorCode = exceptionBody?.code ?? exceptionBody?.error ?? errorName;

    void this.errorLogsService.create({
      requestId,
      serviceName: env.serviceName,
      serviceVersion: env.serviceVersion,
      statusCode,
      errorName,
      errorCode,
      message: normalizedMessage,
      httpMethod: request.method,
      path: request.originalUrl || request.url,
      ...source,
      userId: request.user?.sub && Types.ObjectId.isValid(request.user.sub)
        ? new Types.ObjectId(request.user.sub)
        : undefined,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      request: {
        params: sanitize(request.params) as Record<string, unknown>,
        query: sanitize(request.query) as Record<string, unknown>,
        body: sanitize(request.body) as Record<string, unknown>,
      },
      stack,
      kafka: {
        queued: false,
      },
    });

    this.logger.error(
      `[${requestId}] ${request.method} ${request.originalUrl || request.url} ${statusCode} - ${normalizedMessage}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(statusCode).json({
      requestId,
      statusCode,
      code: errorCode,
      message: statusCode >= 500
        ? 'Internal server error'
        : message,
      path: request.originalUrl || request.url,
      method: request.method,
      service: {
        name: env.serviceName,
        version: env.serviceVersion,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
