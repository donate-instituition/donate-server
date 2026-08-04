import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Follow, FollowSchema } from './schemas/follow.schema';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
