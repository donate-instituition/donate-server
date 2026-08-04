import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { Donation, DonationSchema } from './schemas/donation.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { TaxReceipt, TaxReceiptSchema } from '../tax-receipts/schemas/tax-receipt.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donation.name, schema: DonationSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: TaxReceipt.name, schema: TaxReceiptSchema },
    ]),
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}
