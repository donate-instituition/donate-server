import { CountersService } from './counters.service';

function createRedisServiceMock() {
  return {
    del: jest.fn().mockResolvedValue(0),
    getAndClear: jest.fn(),
    increment: jest.fn().mockResolvedValue(1),
    mget: jest.fn().mockResolvedValue([]),
    scanKeys: jest.fn().mockResolvedValue([]),
    withLock: jest
      .fn()
      .mockImplementation((_key: string, fn: () => unknown) => fn()),
  };
}

function createModelMock() {
  return {
    updateOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

describe('CountersService', () => {
  it('buffers the delta in Redis without calling the fallback', async () => {
    const redisService = createRedisServiceMock();
    const campaignModel = createModelMock();
    const postModel = createModelMock();
    const service = new CountersService(
      redisService as any,
      campaignModel as any,
      postModel as any,
    );
    const fallback = jest.fn().mockResolvedValue(undefined);

    await service.bufferIncrement('campaign', 'c1', 'likesCount', 1, fallback);

    expect(redisService.increment).toHaveBeenCalledWith(
      'counters:campaign:c1:likesCount',
      1,
    );
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to the direct Mongo increment when Redis is unavailable', async () => {
    const redisService = createRedisServiceMock();
    redisService.increment.mockRejectedValueOnce(
      new Error('connection refused'),
    );
    const campaignModel = createModelMock();
    const postModel = createModelMock();
    const service = new CountersService(
      redisService as any,
      campaignModel as any,
      postModel as any,
    );
    const fallback = jest.fn().mockResolvedValue(undefined);

    await service.bufferIncrement('post', 'p1', 'commentsCount', 1, fallback);

    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('batches pending deltas for multiple entities in one mget call', async () => {
    const redisService = createRedisServiceMock();
    redisService.mget.mockResolvedValueOnce([
      2,
      1,
      0, // c1: likes, comments, shares
      null,
      null,
      null, // c2: nothing pending
    ]);
    const service = new CountersService(
      redisService as any,
      createModelMock() as any,
      createModelMock() as any,
    );

    const deltas = await service.getPendingDeltas('campaign', ['c1', 'c2']);

    expect(redisService.mget).toHaveBeenCalledTimes(1);
    expect(deltas.get('c1')).toEqual({
      likesCount: 2,
      commentsCount: 1,
      sharesCount: 0,
    });
    expect(deltas.get('c2')).toEqual({
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    });
  });

  it('flushes pending counters into Mongo, skips zero-delta entities, and invalidates the campaign cache', async () => {
    const redisService = createRedisServiceMock();
    redisService.scanKeys.mockResolvedValueOnce([
      'counters:campaign:c1:likesCount',
      'counters:campaign:c1:commentsCount',
      'counters:post:p1:likesCount',
      'counters:campaign:c2:likesCount',
    ]);
    redisService.getAndClear.mockImplementation((key: string) => {
      if (key === 'counters:campaign:c1:likesCount') return Promise.resolve(3);
      if (key === 'counters:campaign:c1:commentsCount')
        return Promise.resolve(1);
      if (key === 'counters:post:p1:likesCount') return Promise.resolve(-1);
      if (key === 'counters:campaign:c2:likesCount') return Promise.resolve(0);
      return Promise.resolve(null);
    });
    const campaignModel = createModelMock();
    const postModel = createModelMock();
    const service = new CountersService(
      redisService as any,
      campaignModel as any,
      postModel as any,
    );

    const result = await service.flushAll();

    expect(result).toEqual({ flushed: 2 });
    expect(campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: 'c1' },
      { $inc: { 'stats.likesCount': 3, 'stats.commentsCount': 1 } },
    );
    expect(postModel.updateOne).toHaveBeenCalledWith(
      { _id: 'p1' },
      { $inc: { 'stats.likesCount': -1 } },
    );
    // c2's delta cleared to 0 by GETDEL — no Mongo write for it.
    expect(campaignModel.updateOne).toHaveBeenCalledTimes(1);
    expect(redisService.del).toHaveBeenCalledWith('cache:campaign:c1');
    expect(redisService.del).not.toHaveBeenCalledWith('cache:campaign:c2');
  });

  it('returns zero flushed without touching Mongo when another instance holds the flush lock', async () => {
    const redisService = createRedisServiceMock();
    redisService.withLock.mockResolvedValueOnce(null);
    const campaignModel = createModelMock();
    const postModel = createModelMock();
    const service = new CountersService(
      redisService as any,
      campaignModel as any,
      postModel as any,
    );

    const result = await service.flushAll();

    expect(result).toEqual({ flushed: 0 });
    expect(redisService.scanKeys).not.toHaveBeenCalled();
    expect(campaignModel.updateOne).not.toHaveBeenCalled();
  });
});
