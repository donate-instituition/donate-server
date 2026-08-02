import type { NextFunction, Request, Response } from 'express';

import { createRateLimitMiddleware } from './rate-limit.middleware';

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

describe('createRateLimitMiddleware', () => {
  it('returns 429 when the request limit is exceeded', () => {
    const middleware = createRateLimitMiddleware({
      name: `test-${Date.now()}`,
      windowMs: 60_000,
      maxRequests: 2,
    });
    const next: NextFunction = jest.fn();

    middleware(createRequest(), createResponse(), next);
    middleware(createRequest(), createResponse(), next);

    const blockedResponse = createResponse();
    middleware(createRequest(), blockedResponse, next);

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

  it('does not count preflight requests when configured to skip options', () => {
    const middleware = createRateLimitMiddleware({
      name: `test-options-${Date.now()}`,
      windowMs: 60_000,
      maxRequests: 1,
      skipSuccessfulOptions: true,
    });
    const next: NextFunction = jest.fn();

    middleware(createRequest('OPTIONS'), createResponse(), next);
    middleware(createRequest('POST'), createResponse(), next);

    const blockedResponse = createResponse();
    middleware(createRequest('POST'), blockedResponse, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });
});
