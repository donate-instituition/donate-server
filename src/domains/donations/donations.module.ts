import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { Donation, DonationSchema } from './schemas/donation.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donation.name, schema: DonationSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}
