import type { NextFunction, Request, Response } from 'express';

import { IdempotencyMiddleware } from './idempotency.middleware';
import { IdempotencyRecordStatus } from '../schemas/idempotency-record.schema';

const DEFAULT_REQUEST_FINGERPRINT =
  'f1a41c2893fc6ba8f8b677010873713560f15c0ef9541e2bccde93c796ea5321';

type MockResponse = Response & {
  body?: unknown;
  events: Map<string, () => void>;
  headers: Map<string, string>;
  json: jest.MockedFunction<(body: unknown) => MockResponse>;
  send: jest.MockedFunction<(body: unknown) => MockResponse>;
  setHeader: jest.MockedFunction<(key: string, value: string) => MockResponse>;
  status: jest.MockedFunction<(statusCode: number) => MockResponse>;
  statusCode: number;
};

function createRequest(
  body: Record<string, unknown> = { amount: 100 },
): Request {
  return {
    body,
    headers: {
      'idempotency-key': 'idem-1',
    },
    ip: '127.0.0.1',
    method: 'POST',
    originalUrl: '/donations',
    path: '/donations',
    socket: { remoteAddress: '127.0.0.1' },
    url: '/donations',
    on: jest.fn(),
  } as unknown as Request;
}

function createResponse(): MockResponse {
  const response = {} as MockResponse;

  Object.assign(response, {
    events: new Map<string, () => void>(),
    headers: new Map<string, string>(),
    json: jest.fn((body: unknown): MockResponse => {
      response.body = body;
      return response;
    }),
    send: jest.fn((body: unknown): MockResponse => {
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
    statusCode: 201,
    on: jest.fn((event: string, callback: () => void): MockResponse => {
      response.events.set(event, callback);
      return response;
    }),
  });

  return response;
}

function createModelMock() {
  return {
    create: jest.fn().mockResolvedValue({}),
    deleteOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    findOne: jest.fn(),
    updateOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

function createRedisServiceMock(cached: unknown = null) {
  return {
    get: jest.fn().mockResolvedValue(cached),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

describe('IdempotencyMiddleware', () => {
  it('creates an in-progress record and completes it when the response finishes', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock();
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const request = createRequest();
    const response = createResponse();
    const next: NextFunction = jest.fn();

    await middleware.use(request, response, next);
    response.status(201).json({ donationId: 'don-1' });
    response.events.get('finish')?.();

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        method: 'POST',
        path: '/donations',
        status: IdempotencyRecordStatus.InProgress,
      }),
    );
    const [filter, update] = model.updateOne.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
    ];

    expect(filter).toEqual(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        method: 'POST',
        path: '/donations',
      }),
    );
    expect(update.$set).toEqual(
      expect.objectContaining({
        responseBody: { donationId: 'don-1' },
        responseStatusCode: 201,
        responseType: 'json',
        status: IdempotencyRecordStatus.Completed,
      }),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replays a completed response from Mongo', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock();
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const response = createResponse();
    const next: NextFunction = jest.fn();

    model.create.mockRejectedValueOnce({ code: 11000 });
    model.findOne.mockResolvedValueOnce({
      fingerprint: DEFAULT_REQUEST_FINGERPRINT,
      responseBody: { donationId: 'don-1' },
      responseStatusCode: 201,
      responseType: 'json',
      status: IdempotencyRecordStatus.Completed,
    });

    await middleware.use(createRequest(), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.headers.get('Idempotency-Replayed')).toBe('true');
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ donationId: 'don-1' });
  });

  it('returns 409 when the key is reused with a different request body', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock();
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const response = createResponse();
    const next: NextFunction = jest.fn();

    model.create.mockRejectedValueOnce({ code: 11000 });
    model.findOne.mockResolvedValueOnce({
      fingerprint: 'different-fingerprint',
      status: IdempotencyRecordStatus.Completed,
    });

    await middleware.use(createRequest({ amount: 200 }), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'IDEMPOTENCY_CONFLICT',
      }),
    );
  });

  it('returns 409 when the first request is still in progress', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock();
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const response = createResponse();
    const next: NextFunction = jest.fn();

    model.create.mockRejectedValueOnce({ code: 11000 });
    model.findOne.mockResolvedValueOnce({
      fingerprint: DEFAULT_REQUEST_FINGERPRINT,
      status: IdempotencyRecordStatus.InProgress,
    });

    await middleware.use(createRequest(), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.headers.get('Retry-After')).toBe('1');
    expect(response.status).toHaveBeenCalledWith(409);
  });

  it('starts a new request when the matching record has already expired', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock();
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const response = createResponse();
    const next: NextFunction = jest.fn();

    model.create
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce({});
    model.findOne.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() - 1_000),
      fingerprint: DEFAULT_REQUEST_FINGERPRINT,
      status: IdempotencyRecordStatus.Completed,
    });

    await middleware.use(createRequest(), response, next);

    expect(model.deleteOne).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        method: 'POST',
        path: '/donations',
      }),
    );
    expect(model.create).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores mutation requests without an idempotency key', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock();
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const request = createRequest();
    const next: NextFunction = jest.fn();

    request.headers = {};

    await middleware.use(request, createResponse(), next);

    expect(model.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replays from Redis without touching Mongo when the fingerprint matches', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock({
      fingerprint: DEFAULT_REQUEST_FINGERPRINT,
      responseBody: { donationId: 'don-1' },
      responseStatusCode: 201,
      responseType: 'json',
    });
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const response = createResponse();
    const next: NextFunction = jest.fn();

    await middleware.use(createRequest(), response, next);

    expect(model.create).not.toHaveBeenCalled();
    expect(model.findOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(response.headers.get('Idempotency-Replayed')).toBe('true');
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ donationId: 'don-1' });
  });

  it('falls through to Mongo when the cached fingerprint does not match', async () => {
    const model = createModelMock();
    const redisService = createRedisServiceMock({
      fingerprint: 'different-fingerprint',
      responseBody: { donationId: 'stale' },
      responseStatusCode: 201,
      responseType: 'json',
    });
    const middleware = new IdempotencyMiddleware(
      model as never,
      redisService as never,
    );
    const request = createRequest();
    const response = createResponse();
    const next: NextFunction = jest.fn();

    await middleware.use(request, response, next);
    response.status(201).json({ donationId: 'don-1' });
    response.events.get('finish')?.();

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        status: IdempotencyRecordStatus.InProgress,
      }),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
