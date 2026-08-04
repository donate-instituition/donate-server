import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Follow, FollowSchema } from '../follows/schemas/follow.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema';
import { Post as PostEntity, PostSchema } from './schemas/post.schema';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Follow.name, schema: FollowSchema },
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
      { name: Institution.name, schema: InstitutionSchema },
      { name: PostEntity.name, schema: PostSchema },
    ]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
