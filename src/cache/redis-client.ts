import { createClient, type RedisClientType } from 'redis';

import { PrettyLogger } from '../common/logger';
import { env } from '../config/env';

const CONTEXT = 'Redis';
// How long a caller waits for a connection before failing open. The
// underlying client keeps retrying in the background via reconnectStrategy
// regardless of this timeout, so Redis coming back later self-heals it.
const CONNECT_WAIT_TIMEOUT_MS = 1_500;
const logger = new PrettyLogger();

let client: RedisClientType | undefined;
let connectPromise: Promise<RedisClientType> | undefined;

function createRedisClient(): RedisClientType {
  const redisClient = createClient({
    url: env.redisUrl,
    keyPrefix: env.redisKeyPrefix,
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  });

  redisClient.on('error', (error) => {
    logger.warn('Redis client error', CONTEXT, {
      message: error instanceof Error ? error.message : String(error),
    });
  });
  redisClient.on('reconnecting', () => {
    logger.debug('Redis reconnecting', CONTEXT);
  });
  redisClient.on('ready', () => {
    logger.log('Redis connected', CONTEXT);
  });

  return redisClient;
}

export function getRedisClient(): RedisClientType {
  if (!client) {
    client = createRedisClient();
  }

  return client;
}

export async function ensureRedisConnected(): Promise<RedisClientType> {
  const redisClient = getRedisClient();

  if (redisClient.isReady) {
    return redisClient;
  }

  if (!connectPromise) {
    connectPromise = redisClient
      .connect()
      .then(() => redisClient)
      .finally(() => {
        connectPromise = undefined;
      });
  }

  // reconnectStrategy retries forever in the background, so `connect()` may
  // never settle while Redis is down; bound how long a caller waits for it.
  return withRedisTimeout(
    connectPromise,
    CONNECT_WAIT_TIMEOUT_MS,
    'Redis connect',
  );
}

export async function closeRedisClient() {
  if (!client) {
    return;
  }

  const redisClient = client;
  client = undefined;
  await redisClient.quit().catch(() => redisClient.disconnect());
}

export async function withRedisTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Atomically increments a fixed-window counter, setting its expiry only on
 * the first hit in the window (PEXPIRE ... NX). Backs rate limiting and any
 * other "N per window" check.
 */
export async function incrementWindow(
  key: string,
  windowMs: number,
): Promise<{ count: number; ttlMs: number }> {
  const redisClient = await ensureRedisConnected();
  const results = await redisClient
    .multi()
    .incr(key)
    .pExpire(key, windowMs, 'NX')
    .pTTL(key)
    .exec();
  const [count, , ttl] = results as unknown as [number, number, number];

  return { count, ttlMs: ttl > 0 ? ttl : windowMs };
}

const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

/** Sets key only if absent, returning a token to release it with, or null if already locked. */
export async function acquireLock(
  key: string,
  ttlMs: number,
): Promise<string | null> {
  const redisClient = await ensureRedisConnected();
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const acquired = await redisClient.set(key, token, {
    expiration: { type: 'PX', value: ttlMs },
    condition: 'NX',
  });

  return acquired ? token : null;
}

/** Releases the lock only if it is still held by this token (safe against expiry races). */
export async function releaseLock(
  key: string,
  token: string,
): Promise<boolean> {
  const redisClient = await ensureRedisConnected();
  const released = await redisClient.eval(RELEASE_LOCK_SCRIPT, {
    keys: [key],
    arguments: [token],
  });

  return released === 1;
}
