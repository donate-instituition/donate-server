import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Campaign,
  CampaignSchema,
} from '../domains/campaigns/schemas/campaign.schema';
import {
  Post as PostEntity,
  PostSchema,
} from '../domains/posts/schemas/post.schema';
import { CountersFlushScheduler } from './counters-flush.scheduler';
import { CountersService } from './counters.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: PostEntity.name, schema: PostSchema },
    ]),
  ],
  providers: [CountersService, CountersFlushScheduler],
  exports: [CountersService],
})
export class CountersModule {}
