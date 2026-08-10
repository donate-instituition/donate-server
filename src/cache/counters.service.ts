import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Campaign,
  CampaignDocument,
} from '../domains/campaigns/schemas/campaign.schema';
import {
  Post as PostEntity,
  PostDocument,
} from '../domains/posts/schemas/post.schema';
import { campaignCacheKey } from './cache-keys';
import { RedisService } from './redis.service';

export type CounterEntityType = 'campaign' | 'post';
export type CounterName = 'likesCount' | 'commentsCount' | 'sharesCount';

export type CounterDeltas = Record<CounterName, number>;

const COUNTER_NAMES: CounterName[] = [
  'likesCount',
  'commentsCount',
  'sharesCount',
];
const ZERO_DELTAS: CounterDeltas = {
  likesCount: 0,
  commentsCount: 0,
  sharesCount: 0,
};
const FLUSH_LOCK_TTL_MS = 30_000;
const KEY_PATTERN =
  /^counters:(campaign|post):([^:]+):(likesCount|commentsCount|sharesCount)$/;

/**
 * Write-behind consolidation for social-engagement counters (likes,
 * comments, shares). Increments land in Redis first (cheap, fast); a
 * periodic job (`CountersFlushScheduler`) drains them into Mongo's `stats.*`
 * fields via `$inc`. Money-adjacent counters (donationsCount, moneyRaised)
 * and postsCount/followersCount are NOT covered here — they keep writing
 * directly to Mongo.
 */
@Injectable()
export class CountersService {
  private readonly logger = new Logger(CountersService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(PostEntity.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  private key(
    entityType: CounterEntityType,
    entityId: string,
    counter: CounterName,
  ) {
    return `counters:${entityType}:${entityId}:${counter}`;
  }

  /**
   * Buffers the delta in Redis. If Redis is unavailable, calls `fallback`
   * immediately instead — the caller passes today's direct Mongo `$inc`, so
   * an outage degrades to the old behavior for that one event rather than
   * silently losing the increment.
   */
  async bufferIncrement(
    entityType: CounterEntityType,
    entityId: string,
    counter: CounterName,
    delta: number,
    fallback: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.redisService.increment(
        this.key(entityType, entityId, counter),
        delta,
      );
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for ${entityType}:${entityId}:${counter}, falling back to direct Mongo increment: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await fallback();
    }
  }

  /** Batched pending-delta read across every counter for a set of entity ids, in one round trip. */
  async getPendingDeltas(
    entityType: CounterEntityType,
    entityIds: string[],
  ): Promise<Map<string, CounterDeltas>> {
    const result = new Map<string, CounterDeltas>();

    if (entityIds.length === 0) {
      return result;
    }

    const keys = entityIds.flatMap((id) =>
      COUNTER_NAMES.map((counter) => this.key(entityType, id, counter)),
    );
    const values = await this.redisService
      .mget<number>(keys)
      .catch(() => keys.map(() => null));

    entityIds.forEach((id, entityIndex) => {
      const deltas = { ...ZERO_DELTAS };

      COUNTER_NAMES.forEach((counter, counterIndex) => {
        deltas[counter] =
          values[entityIndex * COUNTER_NAMES.length + counterIndex] ?? 0;
      });

      result.set(id, deltas);
    });

    return result;
  }

  async getPendingDelta(
    entityType: CounterEntityType,
    entityId: string,
  ): Promise<CounterDeltas> {
    const deltas = await this.getPendingDeltas(entityType, [entityId]);
    return deltas.get(entityId) ?? { ...ZERO_DELTAS };
  }

  private parseKey(key: string) {
    const match = KEY_PATTERN.exec(key);

    if (!match) {
      return null;
    }

    const [, entityType, entityId, counter] = match;
    return {
      entityType: entityType as CounterEntityType,
      entityId,
      counter: counter as CounterName,
    };
  }

  /** Drains every pending counter key into Mongo. Locked so only one instance flushes at a time. */
  async flushAll(): Promise<{ flushed: number }> {
    const result = await this.redisService.withLock(
      'locks:counters-flush',
      () => this.flushOnce(),
      FLUSH_LOCK_TTL_MS,
    );

    return result ?? { flushed: 0 };
  }

  private async flushOnce(): Promise<{ flushed: number }> {
    const keys = await this.redisService.scanKeys('counters:*');
    const byEntity = new Map<
      string,
      {
        entityType: CounterEntityType;
        entityId: string;
        inc: Partial<CounterDeltas>;
      }
    >();

    for (const key of keys) {
      const parsed = this.parseKey(key);

      if (!parsed) {
        continue;
      }

      const delta = await this.redisService.getAndClear(key);

      if (!delta) {
        continue;
      }

      const entityKey = `${parsed.entityType}:${parsed.entityId}`;
      const entry = byEntity.get(entityKey) ?? {
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        inc: {},
      };

      entry.inc[parsed.counter] = (entry.inc[parsed.counter] ?? 0) + delta;
      byEntity.set(entityKey, entry);
    }

    let flushed = 0;

    for (const { entityType, entityId, inc } of byEntity.values()) {
      const incFields: Record<string, number> = {};

      for (const [counter, delta] of Object.entries(inc)) {
        if (delta) {
          incFields[`stats.${counter}`] = delta;
        }
      }

      if (Object.keys(incFields).length === 0) {
        continue;
      }

      const model: Model<CampaignDocument | PostDocument> =
        entityType === 'campaign' ? this.campaignModel : this.postModel;

      try {
        await model.updateOne({ _id: entityId }, { $inc: incFields }).exec();
        flushed += 1;

        // The entity's own cache-aside entry still holds the pre-flush
        // count until this invalidates it — otherwise reads would show
        // (stale cached baseline + now-zeroed pending delta), silently
        // undercounting until the cache's TTL happens to expire.
        if (entityType === 'campaign') {
          await this.redisService
            .del(campaignCacheKey(entityId))
            .catch(() => undefined);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to flush counters for ${entityType}:${entityId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { flushed };
  }
}
