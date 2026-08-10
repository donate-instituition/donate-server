import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { incrementWindow } from '../../cache/redis-client';

type RateLimitWindowResult = { count: number; ttlMs: number };

export type RateLimitStore = {
  incrementWindow(
    key: string,
    windowMs: number,
  ): Promise<RateLimitWindowResult>;
};

type RateLimitOptions = {
  name: string;
  windowMs: number;
  maxRequests: number;
  scope?: 'client' | 'route';
  skipSuccessfulOptions?: boolean;
  /** Backing counter store; defaults to the shared Redis client. Override in tests. */
  store?: RateLimitStore;
};

const logger = new Logger('RateLimit');

const redisRateLimitStore: RateLimitStore = {
  incrementWindow: (key, windowMs) => incrementWindow(key, windowMs),
};

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

function getRateLimitKey(
  name: string,
  request: Request,
  scope: RateLimitOptions['scope'],
) {
  const clientIp = getClientIp(request);

  if (scope === 'client') {
    return `ratelimit:${name}:${clientIp}`;
  }

  return `ratelimit:${name}:${clientIp}:${request.method}:${request.path}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  if (options.windowMs <= 0) {
    throw new Error('Rate limit windowMs must be greater than zero');
  }

  if (options.maxRequests <= 0) {
    throw new Error('Rate limit maxRequests must be greater than zero');
  }

  const scope = options.scope ?? 'route';
  const store = options.store ?? redisRateLimitStore;

  return async (request: Request, response: Response, next: NextFunction) => {
    if (options.skipSuccessfulOptions && request.method === 'OPTIONS') {
      next();
      return;
    }

    const key = getRateLimitKey(options.name, request, scope);
    let result: RateLimitWindowResult;

    try {
      result = await store.incrementWindow(key, options.windowMs);
    } catch (error) {
      // Redis is unavailable: fail open rather than block all traffic.
      logger.warn(
        `Rate limit store unavailable for "${options.name}", allowing request: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      next();
      return;
    }

    const remaining = Math.max(options.maxRequests - result.count, 0);
    const resetSeconds = Math.ceil(result.ttlMs / 1000);

    response.setHeader('RateLimit-Limit', String(options.maxRequests));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));
    response.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (result.count <= options.maxRequests) {
      next();
      return;
    }

    response.setHeader('Retry-After', String(resetSeconds));
    response.status(429).json({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas tentativas. Aguarde um momento e tente novamente.',
      path: request.originalUrl || request.url,
      method: request.method,
      retryAfterSeconds: resetSeconds,
    });
  };
}
