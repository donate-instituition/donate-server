import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';

import { env } from '../config/env';
import { CountersService } from './counters.service';

@Injectable()
export class CountersFlushScheduler
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(CountersFlushScheduler.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(private readonly countersService: CountersService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      this.countersService.flushAll().catch((error) => {
        this.logger.warn(
          `Counters flush cycle failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, env.countersFlushIntervalMs);
    this.interval.unref?.();
  }

  onApplicationShutdown() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
