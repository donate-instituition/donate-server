import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { env } from '../../config/env';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { DonationStatus, DonationDeliveryMode, DonationType, DonationVisibility } from '../donations/models';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripePaymentIntentDto } from './dto/create-stripe-payment-intent.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentGateway, PaymentMethod, PaymentStatus } from './models';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsService {
  private stripeClient?: Stripe;

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Donation.name) private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
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
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: dto.amountCents,
        currency: env.stripeCurrency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          campaignId: campaignId.toString(),
          donationId: donation._id.toString(),
          donorUserId: donorId.toString(),
          institutionId: campaign.institutionId.toString(),
        },
        receipt_email: dto.receiptEmail?.trim() || undefined,
        setup_future_usage: dto.savePaymentMethod ? 'off_session' : undefined,
      },
      idempotencyKey ? { idempotencyKey: `payment-intent:${idempotencyKey}` } : undefined,
    );

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
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      donation: await this.enrichDonation(donation),
      payment: {
        id: payment._id.toString(),
        paymentIntentId: paymentIntent.id,
        status: payment.status,
      },
    };
  }

  async confirmStripePaymentIntent(paymentIntentId: string) {
    const stripe = this.getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const payment = await this.paymentModel
      .findOne({ gateway: PaymentGateway.STRIPE, gatewayTransactionId: paymentIntent.id })
      .exec();

    if (!payment) {
      throw new NotFoundException(`Pagamento ${paymentIntent.id} não encontrado.`);
    }

    const nextPaymentStatus = this.toPaymentStatus(paymentIntent.status);
    const shouldMarkPaid =
      paymentIntent.status === 'succeeded' && payment.status !== PaymentStatus.PAID;

    payment.status = nextPaymentStatus;
    payment.gatewayPayload = {
      ...(payment.gatewayPayload ?? {}),
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      latestCharge: paymentIntent.latest_charge,
    };

    if (shouldMarkPaid) {
      payment.paidAt = new Date();
    }

    await payment.save();

    const donation = await this.donationModel.findById(payment.donationId).exec();

    if (!donation) {
      throw new NotFoundException(`Doação ${payment.donationId.toString()} não encontrada.`);
    }

    if (shouldMarkPaid) {
      donation.status = DonationStatus.PAID;
      await donation.save();
      await this.campaignModel
        .findByIdAndUpdate(donation.campaignId, {
          $inc: {
            'progress.moneyRaised': payment.amount / 100,
            'stats.donationsCount': 1,
          },
        })
        .exec();
    } else if (nextPaymentStatus === PaymentStatus.FAILED) {
      donation.status = DonationStatus.FAILED;
      await donation.save();
    } else if (nextPaymentStatus === PaymentStatus.CANCELED) {
      donation.status = DonationStatus.CANCELED;
      await donation.save();
    }

    return {
      donation: await this.enrichDonation(donation),
      payment: {
        id: payment._id.toString(),
        paymentIntentId: paymentIntent.id,
        status: payment.status,
      },
    };
  }
}
