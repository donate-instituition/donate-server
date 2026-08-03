import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';

import { env } from '../../../config/env';
import { PrettyLogger } from '../../logger';
import {
  IdempotencyRecord,
  IdempotencyRecordDocument,
  IdempotencyRecordStatus,
} from '../schemas/idempotency-record.schema';

type CachedResponseType = 'json' | 'send';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`;
}

function getHeaderValue(request: Request, header: string) {
  const value = request.headers[header];

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return '';
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0].split(',')[0].trim();
  }

  return request.ip || request.socket.remoteAddress || 'unknown';
}

function createFingerprint(request: Request) {
  return createHash('sha256')
    .update(request.method)
    .update(':')
    .update(request.path)
    .update(':')
    .update(stableStringify(request.body ?? {}))
    .digest('hex');
}

function createScope(request: Request) {
  return getHeaderValue(request, 'x-idempotency-scope') || getClientIp(request);
}

function getCompletedExpiresAt() {
  return new Date(Date.now() + env.idempotencyTtlMs);
}

function getInProgressExpiresAt() {
  return new Date(Date.now() + Math.min(env.idempotencyTtlMs, 60_000));
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function sendConflict(response: Response, message: string) {
  response.status(409).json({
    statusCode: 409,
    code: 'IDEMPOTENCY_CONFLICT',
    message,
  });
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new PrettyLogger();

  constructor(
    @InjectModel(IdempotencyRecord.name)
    private readonly idempotencyRecordModel: Model<IdempotencyRecordDocument>,
  ) {}

  async use(request: Request, response: Response, next: NextFunction) {
    if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const idempotencyKey = getHeaderValue(request, IDEMPOTENCY_HEADER);

    if (!idempotencyKey) {
      next();
      return;
    }

    const scope = createScope(request);
    const method = request.method.toUpperCase();
    const path = request.path;
    const fingerprint = createFingerprint(request);
    const filter = {
      idempotencyKey,
      method,
      path,
      scope,
    };

    try {
      await this.idempotencyRecordModel.create({
        expiresAt: getInProgressExpiresAt(),
        fingerprint,
        idempotencyKey,
        method,
        path,
        scope,
        status: IdempotencyRecordStatus.InProgress,
      });
      this.logger.debug('Idempotency key accepted', IdempotencyMiddleware.name, {
        idempotencyKey,
        method,
        path,
        scope,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        this.logger.error(
          'Idempotency storage failed',
          error instanceof Error ? error.stack : undefined,
          IdempotencyMiddleware.name,
          {
            idempotencyKey,
            method,
            path,
            scope,
          },
        );
        next(error);
        return;
      }

      const existingRecord = await this.idempotencyRecordModel.findOne(filter);

      if (!existingRecord) {
        this.logger.warn('Idempotency duplicate key without record', IdempotencyMiddleware.name, {
          idempotencyKey,
          method,
          path,
          scope,
        });
        next(error);
        return;
      }

      if (existingRecord.expiresAt <= new Date()) {
        this.logger.debug('Idempotency key expired; retrying request', IdempotencyMiddleware.name, {
          idempotencyKey,
          method,
          path,
          scope,
        });
        await this.idempotencyRecordModel
          .deleteOne({
            ...filter,
            expiresAt: { $lte: new Date() },
          })
          .exec();

        try {
          await this.idempotencyRecordModel.create({
            expiresAt: getInProgressExpiresAt(),
            fingerprint,
            idempotencyKey,
            method,
            path,
            scope,
            status: IdempotencyRecordStatus.InProgress,
          });
          this.captureResponse(request, response, filter);
          next();
          return;
        } catch (retryError) {
          next(retryError);
          return;
        }
      }

      if (existingRecord.fingerprint !== fingerprint) {
        this.logger.warn('Idempotency key conflict', IdempotencyMiddleware.name, {
          idempotencyKey,
          method,
          path,
          scope,
        });
        sendConflict(
          response,
          'Idempotency-Key already used with a different request.',
        );
        return;
      }

      if (existingRecord.status === IdempotencyRecordStatus.InProgress) {
        this.logger.warn('Idempotency key already in progress', IdempotencyMiddleware.name, {
          idempotencyKey,
          method,
          path,
          scope,
        });
        response.setHeader('Retry-After', '1');
        sendConflict(
          response,
          'A request with this Idempotency-Key is already in progress.',
        );
        return;
      }

      response.setHeader('Idempotency-Replayed', 'true');
      this.logger.debug('Idempotency response replayed', IdempotencyMiddleware.name, {
        idempotencyKey,
        method,
        path,
        scope,
        statusCode: existingRecord.responseStatusCode,
      });
      response.status(existingRecord.responseStatusCode ?? 200);

      if (existingRecord.responseType === 'send') {
        response.send(existingRecord.responseBody);
        return;
      }

      response.json(existingRecord.responseBody);
      return;
    }

    this.captureResponse(request, response, filter);

    next();
  }

  private captureResponse(
    request: Request,
    response: Response,
    filter: {
      idempotencyKey: string;
      method: string;
      path: string;
      scope: string;
    },
  ) {
    let responseBody: unknown;
    let responseType: CachedResponseType = 'json';
    const originalJson = response.json.bind(response) as unknown as (
      body?: unknown,
    ) => Response;
    const originalSend = response.send.bind(response) as unknown as (
      body?: unknown,
    ) => Response;

    response.json = ((body: unknown) => {
      responseBody = body;
      responseType = 'json';
      return originalJson(body);
    }) as Response['json'];

    response.send = ((body: unknown) => {
      responseBody = body;
      responseType = 'send';
      return originalSend(body);
    }) as Response['send'];

    response.on('finish', () => {
      if (response.statusCode >= 500 || response.statusCode === 429) {
        this.logger.warn('Idempotency key released after failed response', IdempotencyMiddleware.name, {
          idempotencyKey: filter.idempotencyKey,
          method: filter.method,
          path: filter.path,
          scope: filter.scope,
          statusCode: response.statusCode,
        });
        void this.idempotencyRecordModel.deleteOne(filter).exec();
        return;
      }

      this.logger.debug('Idempotency response cached', IdempotencyMiddleware.name, {
        idempotencyKey: filter.idempotencyKey,
        method: filter.method,
        path: filter.path,
        scope: filter.scope,
        statusCode: response.statusCode,
      });
      void this.idempotencyRecordModel
        .updateOne(filter, {
          $set: {
            expiresAt: getCompletedExpiresAt(),
            responseBody,
            responseStatusCode: response.statusCode,
            responseType,
            status: IdempotencyRecordStatus.Completed,
          },
        })
        .exec();
    });

    request.on('aborted', () => {
      this.logger.warn('Idempotency key released after aborted request', IdempotencyMiddleware.name, {
        idempotencyKey: filter.idempotencyKey,
        method: filter.method,
        path: filter.path,
        scope: filter.scope,
      });
      void this.idempotencyRecordModel.deleteOne(filter).exec();
    });
  }
}
