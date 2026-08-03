import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  name: string;
  windowMs: number;
  maxRequests: number;
  scope?: 'client' | 'route';
  skipSuccessfulOptions?: boolean;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const stores = new Map<string, Map<string, RateLimitRecord>>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();

  for (const store of stores.values()) {
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }
}, 60_000);

cleanupInterval.unref?.();

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

function getStore(name: string) {
  const existingStore = stores.get(name);

  if (existingStore) {
    return existingStore;
  }

  const store = new Map<string, RateLimitRecord>();
  stores.set(name, store);
  return store;
}

function getRateLimitKey(request: Request, scope: RateLimitOptions['scope']) {
  const clientIp = getClientIp(request);

  if (scope === 'client') {
    return clientIp;
  }

  return `${clientIp}:${request.method}:${request.path}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  if (options.windowMs <= 0) {
    throw new Error('Rate limit windowMs must be greater than zero');
  }

  if (options.maxRequests <= 0) {
    throw new Error('Rate limit maxRequests must be greater than zero');
  }

  const store = getStore(options.name);
  const scope = options.scope ?? 'route';

  return (request: Request, response: Response, next: NextFunction) => {
    if (options.skipSuccessfulOptions && request.method === 'OPTIONS') {
      next();
      return;
    }

    const now = Date.now();
    const key = getRateLimitKey(request, scope);
    const current = store.get(key);
    const record =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + options.windowMs };

    record.count += 1;
    store.set(key, record);

    const remaining = Math.max(options.maxRequests - record.count, 0);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    response.setHeader('RateLimit-Limit', String(options.maxRequests));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));
    response.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (record.count <= options.maxRequests) {
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
