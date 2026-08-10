import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import {
  CampaignComment,
  CampaignCommentSchema,
} from './schemas/campaign-comment.schema';
import {
  CampaignReaction,
  CampaignReactionSchema,
} from './schemas/campaign-reaction.schema';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignComment.name, schema: CampaignCommentSchema },
      { name: CampaignReaction.name, schema: CampaignReactionSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: User.name, schema: UserSchema },
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
    ]),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
