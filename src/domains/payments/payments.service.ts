import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { env } from '../../config/env';
import { RabbitMqPublisherService } from '../../queues/rabbitmq-publisher.service';
import { createQueueMessage } from '../../queues/queue-message';
import { AppSettingKey } from '../app-settings/app-settings.defaults';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { DonationStatus, DonationDeliveryMode, DonationType, DonationVisibility } from '../donations/models';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripePaymentIntentDto } from './dto/create-stripe-payment-intent.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentGateway, PaymentMethod, PaymentStatus } from './models';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  StripeWebhookEvent,
  StripeWebhookEventDocument,
  StripeWebhookEventStatus,
} from './schemas/stripe-webhook-event.schema';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripeClient?: Stripe;

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(StripeWebhookEvent.name)
    private readonly stripeWebhookEventModel: Model<StripeWebhookEventDocument>,
    @InjectModel(Donation.name) private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
    private readonly rabbitMqPublisher: RabbitMqPublisherService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  private formatCurrency(value: number) {
    return `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
  }

  private toAppDonationStatus(status?: DonationStatus) {
    const statusMap: Record<string, string> = {
      CREATED: 'pending',
      PENDING_PAYMENT: 'pending',
      PAID: 'completed',
      SCHEDULED_PICKUP: 'processing',
      IN_TRANSIT: 'processing',
      DELIVERED: 'completed',
      CANCELED: 'cancelled',
      FAILED: 'failed',
    };

    return status ? statusMap[status] ?? 'pending' : 'pending';
  }

  private toObjectId(value?: string) {
    if (!value) {
      return new Types.ObjectId();
    }

    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid ObjectId');
    }

    return new Types.ObjectId(value);
  }

  private getStripeClient() {
    if (!env.stripeSecretKey) {
      throw new ServiceUnavailableException('Stripe is not configured.');
    }

    this.stripeClient ??= new Stripe(env.stripeSecretKey, {
      appInfo: {
        name: env.serviceName,
        version: env.serviceVersion,
      },
    });

    return this.stripeClient;
  }

  private toPaymentMethod(method?: string) {
    if (method === 'pix') {
      return PaymentMethod.PIX;
    }

    return PaymentMethod.CREDIT_CARD;
  }

  private normalizeStripePaymentIntent(
    paymentIntent: string | Stripe.PaymentIntent | null | undefined,
  ) {
    if (!paymentIntent || typeof paymentIntent === 'string') {
      throw new ServiceUnavailableException('Stripe did not return a payment intent.');
    }

    return paymentIntent;
  }

  private toPaymentStatus(intentStatus: Stripe.PaymentIntent.Status) {
    if (intentStatus === 'succeeded') {
      return PaymentStatus.PAID;
    }

    if (intentStatus === 'canceled') {
      return PaymentStatus.CANCELED;
    }

    if (intentStatus === 'requires_payment_method') {
      return PaymentStatus.FAILED;
    }

    if (intentStatus === 'requires_capture') {
      return PaymentStatus.AUTHORIZED;
    }

    return PaymentStatus.PENDING;
  }

  private async getServiceFeeBps() {
    return this.appSettingsService.getNumber(
      AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      env.stripeServiceFeeBps,
    );
  }

  private getServiceFeeAmount(amountCents: number, serviceFeeBps: number) {
    if (serviceFeeBps <= 0) {
      return 0;
    }

    if (serviceFeeBps >= 10_000) {
      throw new ServiceUnavailableException('Invalid Stripe service fee configuration.');
    }

    return Math.floor((amountCents * serviceFeeBps) / 10_000);
  }

  private getServiceFeePercent(serviceFeeBps: number) {
    if (serviceFeeBps <= 0) {
      return undefined;
    }

    if (serviceFeeBps >= 10_000) {
      throw new ServiceUnavailableException('Invalid Stripe service fee configuration.');
    }

    return serviceFeeBps / 100;
  }

  private assertValidStripeConnectAccountId(
    stripeConnectAccountId?: string,
  ): asserts stripeConnectAccountId is string {
    if (!stripeConnectAccountId) {
      throw new BadRequestException('Institution does not have a Stripe connected account.');
    }

    if (
      !/^acct_[A-Za-z0-9]+$/.test(stripeConnectAccountId) ||
      stripeConnectAccountId.includes('SEU_ID') ||
      stripeConnectAccountId.includes('TESTE')
    ) {
      throw new BadRequestException(
        'Institution Stripe connected account must be a real test acct_... from Stripe.',
      );
    }
  }

  private async enrichDonation(donation: DonationDocument | any) {
    const [campaign, institution] = await Promise.all([
      this.campaignModel.findById(donation.campaignId).lean().exec(),
      this.institutionModel.findById(donation.institutionId).lean().exec(),
    ]);
    const amountCents = donation.moneyDonation?.amount
      ? Math.round(donation.moneyDonation.amount * 100)
      : 0;

    return {
      id: donation._id?.toString() ?? donation.id,
      campaignId: donation.campaignId?.toString() ?? donation.campaignId,
      campaignTitle: campaign?.title ?? 'Campanha',
      institutionName: institution?.displayName || institution?.legalName || 'Instituição',
      amountCents,
      amountFormatted: this.formatCurrency(amountCents),
      status: this.toAppDonationStatus(donation.status),
      createdAt: donation.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  create(createPaymentDto: CreatePaymentDto) {
    return this.paymentModel.create(createPaymentDto);
  }

  findAll() {
    return this.paymentModel.find().sort({ createdAt: -1 }).exec();
  }

  findOne(id: string) {
    return this.paymentModel.findById(id).exec();
  }

  update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return this.paymentModel.findByIdAndUpdate(id, updatePaymentDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.paymentModel.findByIdAndDelete(id).exec();
  }

  async createStripePaymentIntent(
    dto: CreateStripePaymentIntentDto,
    donorUserId?: string,
    idempotencyKey?: string,
  ) {
    if (!dto.campaignId) {
      throw new BadRequestException('campaignId is required');
    }

    if (!dto.amountCents || dto.amountCents <= 0) {
      throw new BadRequestException('amountCents must be greater than zero');
    }

    const campaignId = this.toObjectId(dto.campaignId);
    const campaign = await this.campaignModel.findById(campaignId).lean().exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${dto.campaignId} não encontrada.`);
    }

    const institution = await this.institutionModel.findById(campaign.institutionId).lean().exec();

    if (!institution) {
      throw new NotFoundException('Instituição da campanha não encontrada.');
    }

    this.assertValidStripeConnectAccountId(institution.stripeConnectAccountId);
    const stripeConnectAccountId = institution.stripeConnectAccountId;

    if (dto.donationKind === 'monthly' && !institution.acceptsRecurringDonations) {
      throw new BadRequestException('Institution does not accept recurring donations.');
    }

    const donorId = donorUserId ? this.toObjectId(donorUserId) : new Types.ObjectId();
    const donation = await this.donationModel.create({
      donorUserId: donorId,
      institutionId: campaign.institutionId,
      campaignId,
      type: DonationType.MONEY,
      status: DonationStatus.PENDING_PAYMENT,
      visibility: DonationVisibility.PUBLIC,
      moneyDonation: { amount: dto.amountCents / 100, currency: env.stripeCurrency.toUpperCase() },
      deliveryMode: DonationDeliveryMode.INSTANT_ONLINE,
      receiptEligible: true,
    });

    const stripe = this.getStripeClient();
    const metadata = {
      campaignId: campaignId.toString(),
      donationId: donation._id.toString(),
      donorUserId: donorId.toString(),
      donationKind: dto.donationKind ?? 'single',
      institutionId: campaign.institutionId.toString(),
    };
    const serviceFeeBps = await this.getServiceFeeBps();
    const serviceFeeAmount = this.getServiceFeeAmount(dto.amountCents, serviceFeeBps);
    const serviceFeePercent = this.getServiceFeePercent(serviceFeeBps);
    let paymentIntent: Stripe.PaymentIntent;
    let subscriptionId: string | undefined;

    if (dto.donationKind === 'monthly') {
      const customer = await stripe.customers.create(
        {
          email: dto.receiptEmail?.trim() || undefined,
          metadata: {
            donorUserId: donorId.toString(),
          },
        },
        idempotencyKey ? { idempotencyKey: `customer:${idempotencyKey}` } : undefined,
      );
      const price = await stripe.prices.create(
        {
          currency: env.stripeCurrency,
          product_data: {
            name: `Doação mensal - ${campaign.title}`,
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: dto.amountCents,
        },
        idempotencyKey ? { idempotencyKey: `price:${idempotencyKey}` } : undefined,
      );
      const subscription = await stripe.subscriptions.create(
        {
          customer: customer.id,
          items: [{ price: price.id }],
          metadata,
          payment_behavior: 'default_incomplete',
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          application_fee_percent: serviceFeePercent,
          transfer_data: {
            destination: stripeConnectAccountId,
          },
          expand: ['latest_invoice.payment_intent'],
        },
        idempotencyKey ? { idempotencyKey: `subscription:${idempotencyKey}` } : undefined,
      );
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice & {
        payment_intent?: string | Stripe.PaymentIntent | null;
      };
      paymentIntent = this.normalizeStripePaymentIntent(latestInvoice.payment_intent);
      subscriptionId = subscription.id;
    } else {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: dto.amountCents,
          currency: env.stripeCurrency,
          application_fee_amount: serviceFeeAmount > 0 ? serviceFeeAmount : undefined,
          automatic_payment_methods: {
            enabled: true,
          },
          metadata,
          receipt_email: dto.receiptEmail?.trim() || undefined,
          setup_future_usage: dto.savePaymentMethod ? 'off_session' : undefined,
          transfer_data: {
            destination: stripeConnectAccountId,
          },
        },
        idempotencyKey ? { idempotencyKey: `payment-intent:${idempotencyKey}` } : undefined,
      );
    }

    const payment = await this.paymentModel.create({
      donationId: donation._id,
      donorUserId: donorId,
      institutionId: campaign.institutionId,
      gateway: PaymentGateway.STRIPE,
      gatewayTransactionId: paymentIntent.id,
      paymentMethod: this.toPaymentMethod(dto.paymentMethod),
      amount: dto.amountCents,
      currency: env.stripeCurrency.toUpperCase(),
      status: this.toPaymentStatus(paymentIntent.status),
      gatewayPayload: {
        donationKind: dto.donationKind ?? 'single',
        serviceFeeAmount,
        serviceFeeBps,
        paymentIntentId: paymentIntent.id,
        subscriptionId,
        status: paymentIntent.status,
        transferDestination: stripeConnectAccountId,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      donation: await this.enrichDonation(donation),
      payment: {
        id: payment._id.toString(),
        paymentIntentId: paymentIntent.id,
        serviceFeeAmount,
        serviceFeeBps,
        status: payment.status,
        subscriptionId,
      },
    };
  }

  async confirmStripePaymentIntent(paymentIntentId: string) {
    const payment = await this.paymentModel
      .findOne({ gateway: PaymentGateway.STRIPE, gatewayTransactionId: paymentIntentId })
      .exec();

    if (!payment) {
      throw new NotFoundException(`Pagamento ${paymentIntentId} não encontrado.`);
    }

    const donation = await this.donationModel.findById(payment.donationId).exec();

    if (!donation) {
      throw new NotFoundException(`Doação ${payment.donationId.toString()} não encontrada.`);
    }

    return {
      donation: await this.enrichDonation(donation),
      payment: {
        id: payment._id.toString(),
        paymentIntentId,
        serviceFeeAmount: Number((payment.gatewayPayload as any)?.serviceFeeAmount ?? 0),
        serviceFeeBps: Number((payment.gatewayPayload as any)?.serviceFeeBps ?? 0),
        status: payment.status,
        subscriptionId: (payment.gatewayPayload as any)?.subscriptionId,
      },
    };
  }

  async cancelStripeSubscription(subscriptionId: string, donorUserId?: string) {
    if (!subscriptionId) {
      throw new BadRequestException('subscriptionId is required');
    }

    const payment = await this.paymentModel
      .findOne({ 'gatewayPayload.subscriptionId': subscriptionId })
      .exec();

    if (!payment) {
      throw new NotFoundException(`Assinatura ${subscriptionId} não encontrada.`);
    }

    if (donorUserId && payment.donorUserId.toString() !== donorUserId) {
      throw new BadRequestException('Subscription does not belong to the current user.');
    }

    const stripe = this.getStripeClient();
    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    payment.gatewayPayload = {
      ...(payment.gatewayPayload ?? {}),
      subscriptionCanceledAt: new Date().toISOString(),
      subscriptionStatus: subscription.status,
    };
    await payment.save();

    return {
      canceled: subscription.status === 'canceled',
      subscriptionId,
      status: subscription.status,
    };
  }

  async getStripeConfig() {
    const serviceFeeBps = await this.getServiceFeeBps();

    return {
      currency: env.stripeCurrency.toUpperCase(),
      serviceFeeBps,
    };
  }

  async enqueueStripeWebhookEvent(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    parsedBody: unknown,
  ) {
    const stripe = this.getStripeClient();
    let event: Stripe.Event;

    if (env.stripeWebhookSecret) {
      if (!rawBody || !signature) {
        throw new BadRequestException('Missing Stripe webhook signature.');
      }

      event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
    } else {
      event = parsedBody as Stripe.Event;
    }

    if (env.stripeSecretKey.startsWith('sk_test_') && event.livemode) {
      throw new BadRequestException('Live Stripe event received while using test API keys.');
    }

    if (env.stripeSecretKey.startsWith('sk_live_') && !event.livemode) {
      throw new BadRequestException('Test Stripe event received while using live API keys.');
    }

    await this.stripeWebhookEventModel.updateOne(
      { eventId: event.id },
      {
        $setOnInsert: {
          eventId: event.id,
          livemode: Boolean(event.livemode),
          payload: event,
          status: StripeWebhookEventStatus.QUEUED,
          type: event.type,
        },
      },
      { upsert: true },
    ).exec();

    await this.rabbitMqPublisher.publish(
      'stripe.webhook',
      createQueueMessage({
        idempotencyKey: `stripe-webhook:${event.id}`,
        payload: {
          eventId: event.id,
        },
        type: 'stripe.webhook',
      }),
    );

    this.logger.log(
      JSON.stringify({
        event: 'stripe_webhook_queued',
        eventId: event.id,
        livemode: event.livemode,
        type: event.type,
      }),
    );

    return { received: true, queued: true };
  }
}
