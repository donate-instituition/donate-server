import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import {
  acquireLock,
  closeRedisClient,
  ensureRedisConnected,
  incrementWindow,
  releaseLock,
} from './redis-client';

const DEFAULT_LOCK_TTL_MS = 30_000;

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
