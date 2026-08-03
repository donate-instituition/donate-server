import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';

import { env } from '../../../config/env';
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
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        next(error);
        return;
      }

      const existingRecord = await this.idempotencyRecordModel.findOne(filter);

      if (!existingRecord) {
        next(error);
        return;
      }

      if (existingRecord.expiresAt <= new Date()) {
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
        sendConflict(
          response,
          'Idempotency-Key already used with a different request.',
        );
        return;
      }

      if (existingRecord.status === IdempotencyRecordStatus.InProgress) {
        response.setHeader('Retry-After', '1');
        sendConflict(
          response,
          'A request with this Idempotency-Key is already in progress.',
        );
        return;
      }

      response.setHeader('Idempotency-Replayed', 'true');
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
        void this.idempotencyRecordModel.deleteOne(filter).exec();
        return;
      }

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
      void this.idempotencyRecordModel.deleteOne(filter).exec();
    });
  }
}
