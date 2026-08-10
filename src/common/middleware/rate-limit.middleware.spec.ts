import type { NextFunction, Request, Response } from 'express';

import {
  createRateLimitMiddleware,
  type RateLimitStore,
} from './rate-limit.middleware';

type MockResponse = Response & {
  body?: unknown;
  headers: Map<string, string>;
  json: jest.MockedFunction<(body: unknown) => MockResponse>;
  setHeader: jest.MockedFunction<(key: string, value: string) => MockResponse>;
  status: jest.MockedFunction<(statusCode: number) => MockResponse>;
  statusCode?: number;
};

function createRequest(method = 'POST', path = '/auth/login'): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    method,
    originalUrl: path,
    path,
    socket: { remoteAddress: '127.0.0.1' },
    url: path,
  } as Request;
}

function createResponse(): MockResponse {
  const response = {} as MockResponse;

  Object.assign(response, {
    headers: new Map<string, string>(),
    json: jest.fn((body: unknown): MockResponse => {
      response.body = body;
      return response;
    }),
    setHeader: jest.fn((key: string, value: string): MockResponse => {
      response.headers.set(key, value);
      return response;
    }),
    status: jest.fn((statusCode: number): MockResponse => {
      response.statusCode = statusCode;
      return response;
    }),
  });

  return response;
}

// In-memory stand-in for the Redis-backed store, so these tests don't need a
// live Redis connection. Mirrors the same fixed-window semantics.
function createFakeStore(): RateLimitStore {
  const counters = new Map<string, { count: number; resetAt: number }>();

  return {
    incrementWindow(key, windowMs) {
      const now = Date.now();
      const existing = counters.get(key);
      const record =
        existing && existing.resetAt > now
          ? existing
          : { count: 0, resetAt: now + windowMs };

      record.count += 1;
      counters.set(key, record);

      return Promise.resolve({
        count: record.count,
        ttlMs: record.resetAt - now,
      });
    },
  };
}

describe('createRateLimitMiddleware', () => {
  it('returns 429 when the request limit is exceeded', async () => {
    const middleware = createRateLimitMiddleware({
      name: `test-${Date.now()}`,
      windowMs: 60_000,
      maxRequests: 2,
      store: createFakeStore(),
    });
    const next: NextFunction = jest.fn();

    await middleware(createRequest(), createResponse(), next);
    await middleware(createRequest(), createResponse(), next);

    const blockedResponse = createResponse();
    await middleware(createRequest(), blockedResponse, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
      }),
    );
    expect(blockedResponse.headers.get('Retry-After')).toBeDefined();
  });

  it('does not count preflight requests when configured to skip options', async () => {
    const middleware = createRateLimitMiddleware({
      name: `test-options-${Date.now()}`,
      windowMs: 60_000,
      maxRequests: 1,
      skipSuccessfulOptions: true,
      store: createFakeStore(),
    });
    const next: NextFunction = jest.fn();

    await middleware(createRequest('OPTIONS'), createResponse(), next);
    await middleware(createRequest('POST'), createResponse(), next);

    const blockedResponse = createResponse();
    await middleware(createRequest('POST'), blockedResponse, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });

  it('can limit all routes for the same client together', async () => {
    const middleware = createRateLimitMiddleware({
      name: `test-client-scope-${Date.now()}`,
      windowMs: 60_000,
      maxRequests: 2,
      scope: 'client',
      store: createFakeStore(),
    });
    const next: NextFunction = jest.fn();

    await middleware(
      createRequest('GET', '/campaigns'),
      createResponse(),
      next,
    );
    await middleware(createRequest('GET', '/posts'), createResponse(), next);

    const blockedResponse = createResponse();
    await middleware(createRequest('GET', '/donations'), blockedResponse, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });

  it('fails open and calls next when the store is unavailable', async () => {
    const store: RateLimitStore = {
      incrementWindow: () => Promise.reject(new Error('connection refused')),
    };
    const middleware = createRateLimitMiddleware({
      name: `test-store-down-${Date.now()}`,
      windowMs: 60_000,
      maxRequests: 1,
      store,
    });
    const next: NextFunction = jest.fn();
    const response = createResponse();

    await middleware(createRequest(), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects invalid rate limit settings', () => {
    expect(() =>
      createRateLimitMiddleware({
        name: `test-invalid-window-${Date.now()}`,
        windowMs: 0,
        maxRequests: 1,
      }),
    ).toThrow('Rate limit windowMs must be greater than zero');

    expect(() =>
      createRateLimitMiddleware({
        name: `test-invalid-max-${Date.now()}`,
        windowMs: 1_000,
        maxRequests: 0,
      }),
    ).toThrow('Rate limit maxRequests must be greater than zero');
  });
});
