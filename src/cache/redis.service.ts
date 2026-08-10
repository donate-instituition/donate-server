import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

import {
  acquireLock,
  closeRedisClient,
  ensureRedisConnected,
  getAndClear,
  increment,
  incrementWindow,
  releaseLock,
  scanKeys,
} from './redis-client';

const DEFAULT_LOCK_TTL_MS = 30_000;
const logger = new Logger('RedisService');

/**
 * Shared cache/coordination client: campaign & feed caching, query caching,
 * temporary sessions/verification codes, and distributed locks. Rate
 * limiting has its own store built on the same primitives (see
 * `common/middleware/rate-limit.middleware.ts`) so it stays testable without
 * a live Redis connection.
 */
@Injectable()
export class RedisService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await closeRedisClient();
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await ensureRedisConnected();
    const raw = await client.get(key);

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = await ensureRedisConnected();
    const raw = JSON.stringify(value);

    if (ttlSeconds) {
      await client.set(key, raw, {
        expiration: { type: 'EX', value: ttlSeconds },
      });
      return;
    }

    await client.set(key, raw);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const client = await ensureRedisConnected();
    return client.del(keys);
  }

  async exists(key: string): Promise<boolean> {
    const client = await ensureRedisConnected();
    return (await client.exists(key)) > 0;
  }

  /** Remaining TTL in ms, or null if the key has no expiry / doesn't exist. */
  async pttl(key: string): Promise<number | null> {
    const client = await ensureRedisConnected();
    const ttl = await client.pTTL(key);

    return ttl > 0 ? ttl : null;
  }

  /** Batched JSON get across multiple keys in one round trip. */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) {
      return [];
    }

    const client = await ensureRedisConnected();
    const raw = await client.mGet(keys);

    return raw.map((value) => {
      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    });
  }

  /**
   * Cache-aside: serve from Redis on hit, otherwise call `loader` and
   * populate the cache in the background. Cache reads/writes never block or
   * fail the response — a Redis outage just falls back to `loader` every
   * time.
   */
  async cacheAside<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);

      if (cached !== null) {
        return cached;
      }
    } catch {
      // fall through to loader
    }

    const value = await loader();

    this.set(key, value, ttlSeconds).catch((error) => {
      logger.warn(
        `Failed to populate cache key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return value;
  }

  /** Plain counter, no TTL: list-cache version numbers, pending write-behind deltas. */
  increment(key: string, delta = 1) {
    return increment(key, delta);
  }

  /** Atomic read-then-delete, used to drain a pending counter without a lost-update window. */
  getAndClear(key: string) {
    return getAndClear(key);
  }

  /** Non-blocking key scan (SCAN, not KEYS). Pattern is relative — no need to include the prefix. */
  scanKeys(matchPattern: string) {
    return scanKeys(matchPattern);
  }

  /** Atomic fixed-window counter (e.g. verification code attempts). */
  incrementWindow(key: string, windowMs: number) {
    return incrementWindow(key, windowMs);
  }

  /** Distributed lock: returns a release token, or null if already held. */
  acquireLock(key: string, ttlMs = DEFAULT_LOCK_TTL_MS) {
    return acquireLock(key, ttlMs);
  }

  /** Releases the lock only if `token` still owns it. */
  releaseLock(key: string, token: string) {
    return releaseLock(key, token);
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs = DEFAULT_LOCK_TTL_MS,
  ): Promise<T | null> {
    const token = await this.acquireLock(key, ttlMs);

    if (!token) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, token);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await ensureRedisConnected();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async getClient() {
    return ensureRedisConnected();
  }
}
