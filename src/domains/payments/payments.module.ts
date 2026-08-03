import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
