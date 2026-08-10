import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TaxReceipt, TaxReceiptSchema } from './schemas/tax-receipt.schema';
import { TaxReceiptsController } from './tax-receipts.controller';
import { TaxReceiptsService } from './tax-receipts.service';
import { TaxReceiptsWorkerService } from './tax-receipts-worker.service';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema';
import {
  NotificationsModule,
} from '../notifications/notifications.module';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EmailJobsModule } from '../../notifications/email/email-jobs.module';
import { QueueModule } from '../../queues/queue.module';

@Module({
  imports: [
    QueueModule,
    EmailJobsModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: TaxReceipt.name, schema: TaxReceiptSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [TaxReceiptsController],
  providers: [TaxReceiptsService, TaxReceiptsWorkerService],
})
export class TaxReceiptsModule {}
