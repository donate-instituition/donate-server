import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Campaign,
  CampaignSchema,
} from '../domains/campaigns/schemas/campaign.schema';
import {
  Donation,
  DonationSchema,
} from '../domains/donations/schemas/donation.schema';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from '../domains/institution-staff-memberships/schemas/institution-staff-membership.schema';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Donation.name, schema: DonationSchema },
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
    ]),
  ],
  providers: [UploadsService],
})
export class UploadsModule {}
