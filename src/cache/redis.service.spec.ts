const ensureRedisConnected = jest.fn();
const closeRedisClient = jest.fn();
const increment = jest.fn();
const getAndClear = jest.fn();
const incrementWindow = jest.fn();
const acquireLock = jest.fn();
const releaseLock = jest.fn();
const scanKeys = jest.fn();

jest.mock('./redis-client', () => ({
  acquireLock: (...args: unknown[]) => acquireLock(...args),
  closeRedisClient: (...args: unknown[]) => closeRedisClient(...args),
  ensureRedisConnected: (...args: unknown[]) => ensureRedisConnected(...args),
  getAndClear: (...args: unknown[]) => getAndClear(...args),
  increment: (...args: unknown[]) => increment(...args),
  incrementWindow: (...args: unknown[]) => incrementWindow(...args),
  releaseLock: (...args: unknown[]) => releaseLock(...args),
  scanKeys: (...args: unknown[]) => scanKeys(...args),
}));

import { RedisService } from './redis.service';

describe('RedisService', () => {
  let client: {
    del: jest.Mock;
    exists: jest.Mock;
    get: jest.Mock;
    mGet: jest.Mock;
    pTTL: jest.Mock;
    ping: jest.Mock;
    set: jest.Mock;
  };
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    client = {
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      get: jest.fn().mockResolvedValue(null),
      mGet: jest.fn().mockResolvedValue([]),
      pTTL: jest.fn().mockResolvedValue(-1),
      ping: jest.fn().mockResolvedValue('PONG'),
      set: jest.fn().mockResolvedValue('OK'),
    };
    ensureRedisConnected.mockResolvedValue(client);
    service = new RedisService();
  });

  describe('get', () => {
    it('returns null on a cache miss', async () => {
      client.get.mockResolvedValue(null);

      await expect(service.get('k')).resolves.toBeNull();
    });

    it('parses and returns a cached JSON value', async () => {
      client.get.mockResolvedValue(JSON.stringify({ a: 1 }));

      await expect(service.get('k')).resolves.toEqual({ a: 1 });
    });

    it('returns null when the cached value is malformed JSON', async () => {
      client.get.mockResolvedValue('{not-json');

      await expect(service.get('k')).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('sets a plain key without ttl', async () => {
      await service.set('k', { a: 1 });

      expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }));
    });

    it('sets a key with an EX expiration when ttlSeconds is given', async () => {
      await service.set('k', { a: 1 }, 60);

      expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }), {
        expiration: { type: 'EX', value: 60 },
      });
    });
  });

  describe('del', () => {
    it('returns 0 without touching the client when no keys are given', async () => {
      await expect(service.del()).resolves.toBe(0);

      expect(ensureRedisConnected).not.toHaveBeenCalled();
    });

    it('deletes the given keys', async () => {
      client.del.mockResolvedValue(2);

      await expect(service.del('a', 'b')).resolves.toBe(2);
      expect(client.del).toHaveBeenCalledWith(['a', 'b']);
    });
  });

  describe('exists', () => {
    it('returns false when the key count is 0', async () => {
      client.exists.mockResolvedValue(0);

      await expect(service.exists('k')).resolves.toBe(false);
    });

    it('returns true when the key count is greater than 0', async () => {
      client.exists.mockResolvedValue(1);

      await expect(service.exists('k')).resolves.toBe(true);
    });
  });

  describe('pttl', () => {
    it('returns null when the key has no expiry', async () => {
      client.pTTL.mockResolvedValue(-1);

      await expect(service.pttl('k')).resolves.toBeNull();
    });

    it('returns the remaining ttl in ms', async () => {
      client.pTTL.mockResolvedValue(5000);

      await expect(service.pttl('k')).resolves.toBe(5000);
    });
  });

  describe('mget', () => {
    it('returns an empty array without touching the client for an empty key list', async () => {
      await expect(service.mget([])).resolves.toEqual([]);

      expect(ensureRedisConnected).not.toHaveBeenCalled();
    });

    it('parses each value, mapping nulls and malformed JSON to null', async () => {
      client.mGet.mockResolvedValue([
        JSON.stringify({ a: 1 }),
        null,
        '{not-json',
      ]);

      await expect(service.mget(['a', 'b', 'c'])).resolves.toEqual([
        { a: 1 },
        null,
        null,
      ]);
    });
  });

  describe('cacheAside', () => {
    it('returns the cached value without calling the loader on a hit', async () => {
      client.get.mockResolvedValue(JSON.stringify('cached'));
      const loader = jest.fn().mockResolvedValue('fresh');

      await expect(service.cacheAside('k', 60, loader)).resolves.toBe(
        'cached',
      );
      expect(loader).not.toHaveBeenCalled();
    });

    it('calls the loader and populates the cache in the background on a miss', async () => {
      client.get.mockResolvedValue(null);
      const loader = jest.fn().mockResolvedValue('fresh');

      const result = await service.cacheAside('k', 60, loader);
      await Promise.resolve();
      await Promise.resolve();

      expect(result).toBe('fresh');
      expect(client.set).toHaveBeenCalledWith('k', JSON.stringify('fresh'), {
        expiration: { type: 'EX', value: 60 },
      });
    });

    it('falls back to the loader when reading the cache throws', async () => {
      ensureRedisConnected.mockRejectedValueOnce(new Error('down'));
      const loader = jest.fn().mockResolvedValue('fresh');

      await expect(service.cacheAside('k', 60, loader)).resolves.toBe(
        'fresh',
      );
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('does not reject when populating the cache after load fails', async () => {
      client.get.mockResolvedValue(null);
      client.set.mockRejectedValueOnce(new Error('write failed'));
      const loader = jest.fn().mockResolvedValue('fresh');

      const result = await service.cacheAside('k', 60, loader);
      await Promise.resolve();
      await Promise.resolve();

      expect(result).toBe('fresh');
    });
  });

  describe('delegating helpers', () => {
    it('increment delegates to the redis-client helper', () => {
      increment.mockReturnValue(Promise.resolve(3));

      const result = service.increment('k', 2);

      expect(increment).toHaveBeenCalledWith('k', 2);
      expect(result).resolves.toBe(3);
    });

    it('increment defaults delta to 1', () => {
      service.increment('k');

      expect(increment).toHaveBeenCalledWith('k', 1);
    });

    it('getAndClear delegates to the redis-client helper', () => {
      service.getAndClear('k');

      expect(getAndClear).toHaveBeenCalledWith('k');
    });

    it('scanKeys delegates to the redis-client helper', () => {
      service.scanKeys('pattern*');

      expect(scanKeys).toHaveBeenCalledWith('pattern*');
    });

    it('incrementWindow delegates to the redis-client helper', () => {
      service.incrementWindow('k', 1000);

      expect(incrementWindow).toHaveBeenCalledWith('k', 1000);
    });

    it('acquireLock delegates with the default ttl', () => {
      service.acquireLock('k');

      expect(acquireLock).toHaveBeenCalledWith('k', 30_000);
    });

    it('acquireLock delegates with a custom ttl', () => {
      service.acquireLock('k', 1000);

      expect(acquireLock).toHaveBeenCalledWith('k', 1000);
    });

    it('releaseLock delegates to the redis-client helper', () => {
      service.releaseLock('k', 'token');

      expect(releaseLock).toHaveBeenCalledWith('k', 'token');
    });
  });

  describe('withLock', () => {
    it('returns null without calling fn when the lock is already held', async () => {
      acquireLock.mockResolvedValue(null);
      const fn = jest.fn();

      await expect(service.withLock('k', fn)).resolves.toBeNull();
      expect(fn).not.toHaveBeenCalled();
      expect(releaseLock).not.toHaveBeenCalled();
    });

    it('runs fn and releases the lock when acquired', async () => {
      acquireLock.mockResolvedValue('token-1');
      const fn = jest.fn().mockResolvedValue('done');

      await expect(service.withLock('k', fn)).resolves.toBe('done');
      expect(releaseLock).toHaveBeenCalledWith('k', 'token-1');
    });

    it('releases the lock even when fn throws', async () => {
      acquireLock.mockResolvedValue('token-1');
      const fn = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(service.withLock('k', fn)).rejects.toThrow('boom');
      expect(releaseLock).toHaveBeenCalledWith('k', 'token-1');
    });
  });

  describe('ping', () => {
    it('returns true when the client responds', async () => {
      await expect(service.ping()).resolves.toBe(true);
    });

    it('returns false when the connection fails', async () => {
      ensureRedisConnected.mockRejectedValueOnce(new Error('down'));

      await expect(service.ping()).resolves.toBe(false);
    });

    it('returns false when ping itself throws', async () => {
      client.ping.mockRejectedValueOnce(new Error('timeout'));

      await expect(service.ping()).resolves.toBe(false);
    });
  });

  describe('getClient', () => {
    it('returns the connected client', async () => {
      await expect(service.getClient()).resolves.toBe(client);
    });
  });

  describe('onApplicationShutdown', () => {
    it('closes the redis client', async () => {
      await service.onApplicationShutdown();

      expect(closeRedisClient).toHaveBeenCalledTimes(1);
    });
  });
});
