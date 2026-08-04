import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Channel, ChannelModel, connect } from 'amqplib';
import { Model } from 'mongoose';
import Stripe from 'stripe';

import { env } from '../../config/env';
import { AppSettingKey } from '../app-settings/app-settings.defaults';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { DonationStatus } from '../donations/models';
import { DonationDeliveryMode, DonationType, DonationVisibility } from '../donations/models';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema';
import { createQueueMessage } from '../../queues/queue-message';
import type { QueueMessage } from '../../queues/queue-message';
import { RabbitMqPublisherService } from '../../queues/rabbitmq-publisher.service';
import { PaymentStatus } from './models';
import { PaymentGateway, PaymentMethod } from './models';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  StripeWebhookEvent,
  StripeWebhookEventDocument,
  StripeWebhookEventStatus,
} from './schemas/stripe-webhook-event.schema';

type StripeWebhookJobPayload = {
  eventId: string;
};

@Injectable()
export class StripeWebhookProcessorService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(StripeWebhookProcessorService.name);
  private channel?: Channel;
  private connection?: ChannelModel;
  private stripeClient?: Stripe;

  constructor(
    @InjectModel(StripeWebhookEvent.name)
    private readonly stripeWebhookEventModel: Model<StripeWebhookEventDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Donation.name) private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
    private readonly appSettingsService: AppSettingsService,
    private readonly rabbitMqPublisher: RabbitMqPublisherService,
  ) {}

  async onModuleInit() {
    if (!env.rabbitmqUrl) {
      this.logger.warn('RabbitMQ is not configured; Stripe webhook jobs will not be consumed.');
      return;
    }

    const connection = await connect(env.rabbitmqUrl);
    const channel = await connection.createChannel();
    this.connection = connection;
    this.channel = channel;

    await channel.assertExchange(env.rabbitmqExchange, 'direct', { durable: true });
    const queue = 'stripe.webhook';
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, env.rabbitmqExchange, 'stripe.webhook');
    await channel.prefetch(5);
    await channel.consume(queue, async (message) => {
      if (!message) return;

      try {
        const job = JSON.parse(message.content.toString()) as QueueMessage<StripeWebhookJobPayload>;
        await this.processQueuedEvent(job.payload.eventId);
        channel.ack(message);
      } catch (error) {
        this.logger.error(
          `Failed to process Stripe webhook job: ${error instanceof Error ? error.message : String(error)}`,
        );
        channel.nack(message, false, true);
      }
    });
  }

  async onApplicationShutdown() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  async processQueuedEvent(eventId: string) {
    const eventRecord = await this.stripeWebhookEventModel.findOneAndUpdate(
      {
        eventId,
        status: { $ne: StripeWebhookEventStatus.PROCESSED },
      },
      {
        $set: {
          status: StripeWebhookEventStatus.PROCESSING,
          lastError: undefined,
        },
      },
      { new: true },
    ).exec();

    if (!eventRecord) {
      this.logger.debug(`Stripe webhook event ${eventId} already processed or not found.`);
      return;
    }

    try {
      const event = eventRecord.payload as unknown as Stripe.Event;
      this.logger.log(
        JSON.stringify({
          event: 'stripe_webhook_processing_started',
          eventId: event.id,
          type: event.type,
        }),
      );

      if (event.type === 'payment_intent.succeeded') {
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      }

      if (
        event.type === 'payment_intent.payment_failed' ||
        event.type === 'payment_intent.canceled'
      ) {
        await this.handlePaymentIntentTerminalFailure(event.data.object as Stripe.PaymentIntent);
      }

      if (event.type === 'invoice.payment_succeeded') {
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      }

      await this.stripeWebhookEventModel.findByIdAndUpdate(eventRecord._id, {
        $set: {
          status: StripeWebhookEventStatus.PROCESSED,
          processedAt: new Date(),
        },
      }).exec();
      this.logger.log(
        JSON.stringify({
          event: 'stripe_webhook_processed',
          eventId: event.id,
          type: event.type,
        }),
      );
    } catch (error) {
      await this.stripeWebhookEventModel.findByIdAndUpdate(eventRecord._id, {
        $set: {
          status: StripeWebhookEventStatus.FAILED,
          lastError: error instanceof Error ? error.message : String(error),
        },
      }).exec();
      throw error;
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentModel
      .findOne({ gatewayTransactionId: paymentIntent.id })
      .exec();

    if (!payment) {
      this.logger.warn(
        JSON.stringify({
          event: 'stripe_payment_intent_without_local_payment',
          paymentIntentId: paymentIntent.id,
        }),
      );
      return;
    }

    if (payment.status === PaymentStatus.PAID) {
      this.logger.debug(
        JSON.stringify({
          event: 'stripe_payment_intent_already_paid',
          paymentId: payment._id.toString(),
          paymentIntentId: paymentIntent.id,
        }),
      );
      return;
    }

    const donation = await this.donationModel.findById(payment.donationId).exec();

    if (!donation) {
      throw new Error(`Donation ${payment.donationId.toString()} not found`);
    }

    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.gatewayPayload = {
      ...(payment.gatewayPayload ?? {}),
      latestCharge: paymentIntent.latest_charge,
      status: paymentIntent.status,
    };
    await payment.save();

    donation.status = DonationStatus.PAID;
    await donation.save();

    await this.campaignModel.findByIdAndUpdate(donation.campaignId, {
      $inc: {
        'progress.moneyRaised': payment.amount / 100,
        'stats.donationsCount': 1,
      },
    }).exec();

    this.logger.log(
      JSON.stringify({
        event: 'stripe_payment_intent_marked_paid',
        donationId: donation._id.toString(),
        paymentId: payment._id.toString(),
        paymentIntentId: paymentIntent.id,
      }),
    );

    await this.queueReceiptGeneration(donation._id.toString(), payment._id.toString());
  }

  private async handlePaymentIntentTerminalFailure(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentModel
      .findOne({ gatewayTransactionId: paymentIntent.id })
      .exec();

    if (!payment || payment.status === PaymentStatus.PAID) {
      return;
    }

    const donation = await this.donationModel.findById(payment.donationId).exec();
    const nextStatus =
      paymentIntent.status === 'canceled' ? PaymentStatus.CANCELED : PaymentStatus.FAILED;

    payment.status = nextStatus;
    payment.gatewayPayload = {
      ...(payment.gatewayPayload ?? {}),
      status: paymentIntent.status,
    };
    await payment.save();

    if (donation) {
      donation.status =
        nextStatus === PaymentStatus.CANCELED ? DonationStatus.CANCELED : DonationStatus.FAILED;
      await donation.save();
    }
  }

  private getStripeClient() {
    if (!env.stripeSecretKey) {
      throw new Error('Stripe is not configured.');
    }

    this.stripeClient ??= new Stripe(env.stripeSecretKey, {
      appInfo: {
        name: env.serviceName,
        version: env.serviceVersion,
      },
    });

    return this.stripeClient;
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const invoiceWithPaymentIntent = invoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
      subscription?: string | Stripe.Subscription | null;
    };
    const paymentIntentId =
      typeof invoiceWithPaymentIntent.payment_intent === 'string'
        ? invoiceWithPaymentIntent.payment_intent
        : invoiceWithPaymentIntent.payment_intent?.id;

    if (!paymentIntentId) {
      return;
    }

    const existingPayment = await this.paymentModel
      .findOne({ gatewayTransactionId: paymentIntentId })
      .exec();

    if (existingPayment) {
      return;
    }

    const subscriptionId =
      typeof invoiceWithPaymentIntent.subscription === 'string'
        ? invoiceWithPaymentIntent.subscription
        : invoiceWithPaymentIntent.subscription?.id;

    if (!subscriptionId) {
      return;
    }

    const subscription = await this.getStripeClient().subscriptions.retrieve(subscriptionId);
    const campaignId = subscription.metadata?.campaignId;
    const donorUserId = subscription.metadata?.donorUserId;
    const institutionId = subscription.metadata?.institutionId;

    if (!campaignId || !donorUserId || !institutionId) {
      throw new Error(`Subscription ${subscriptionId} is missing donation metadata`);
    }

    const amountCents = invoice.amount_paid ?? invoice.amount_due ?? 0;
    const serviceFeeBps = await this.appSettingsService.getNumber(
      AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      env.stripeServiceFeeBps,
    );
    const serviceFeeAmount =
      serviceFeeBps > 0 && serviceFeeBps < 10_000
        ? Math.floor((amountCents * serviceFeeBps) / 10_000)
        : 0;
    const donation = await this.donationModel.create({
      campaignId,
      deliveryMode: DonationDeliveryMode.INSTANT_ONLINE,
      donorUserId,
      institutionId,
      moneyDonation: {
        amount: amountCents / 100,
        currency: (invoice.currency ?? env.stripeCurrency).toUpperCase(),
      },
      receiptEligible: true,
      status: DonationStatus.PAID,
      type: DonationType.MONEY,
      visibility: DonationVisibility.PUBLIC,
    });
    const payment = await this.paymentModel.create({
      amount: amountCents,
      currency: (invoice.currency ?? env.stripeCurrency).toUpperCase(),
      donationId: donation._id,
      donorUserId,
      gateway: PaymentGateway.STRIPE,
      gatewayPayload: {
        donationKind: 'monthly',
        invoiceId: invoice.id,
        paymentIntentId,
        serviceFeeAmount,
        serviceFeeBps,
        status: 'succeeded',
        subscriptionId,
      },
      gatewayTransactionId: paymentIntentId,
      institutionId,
      paidAt: new Date(),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PAID,
    });

    await this.campaignModel.findByIdAndUpdate(campaignId, {
      $inc: {
        'progress.moneyRaised': amountCents / 100,
        'stats.donationsCount': 1,
      },
    }).exec();

    await this.queueReceiptGeneration(donation._id.toString(), payment._id.toString());
  }

  private async queueReceiptGeneration(donationId: string, paymentId: string) {
    await this.rabbitMqPublisher.publish(
      'receipt.generate',
      createQueueMessage({
        idempotencyKey: `receipt-generate:${donationId}:${paymentId}`,
        payload: {
          donationId,
          paymentId,
        },
        type: 'receipt.generate',
      }),
    );
    this.logger.log(
      JSON.stringify({
        event: 'receipt_generation_queued',
        donationId,
        paymentId,
      }),
    );
  }
}
