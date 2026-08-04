import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsController, StripeWebhookController } from './payments.controller';
import { StripeWebhookProcessorService } from './stripe-webhook-processor.service';
import { PaymentsService } from './payments.service';
import {
  StripeWebhookEvent,
  StripeWebhookEventSchema,
} from './schemas/stripe-webhook-event.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema';
import { QueueModule } from '../../queues/queue.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [
    QueueModule,
    AppSettingsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: StripeWebhookEvent.name, schema: StripeWebhookEventSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService, StripeWebhookProcessorService],
})
export class PaymentsModule {}
