import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { PrettyLogger } from './pretty-logger';

function getHeaderValue(request: Request, header: string) {
  const value = request.headers[header.toLowerCase()];

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new PrettyLogger();

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = getHeaderValue(request, 'x-request-id') ?? randomUUID();
    const idempotencyKey = getHeaderValue(request, 'idempotency-key');
    const path = request.originalUrl || request.url;

    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);

    this.logger.debug(
      `${request.method} ${path} started`,
      RequestLoggingMiddleware.name,
      {
        idempotencyKey,
        requestId,
      },
    );

    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const metadata = {
        durationMs,
        idempotencyKey,
        requestId,
        statusCode: response.statusCode,
      };
      const message = `${request.method} ${path} ${response.statusCode} ${durationMs}ms`;

      if (response.statusCode >= 500) {
        this.logger.error(
          message,
          undefined,
          RequestLoggingMiddleware.name,
          metadata,
        );
        return;
      }

      if (response.statusCode >= 400) {
        this.logger.warn(message, RequestLoggingMiddleware.name, metadata);
        return;
      }

      this.logger.log(message, RequestLoggingMiddleware.name, metadata);
    });

    next();
  }
}
