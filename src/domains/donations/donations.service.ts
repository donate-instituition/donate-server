import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  getPaginationOptions,
  paginatedResponse,
  type PaginationQuery,
  shouldPaginate,
} from '../../common/pagination';
import {
  Campaign,
  CampaignDocument,
} from '../campaigns/schemas/campaign.schema';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import {
  DonationDeliveryMode,
  DonationStatus,
  DonationType,
  DonationVisibility,
} from './models';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { Donation, DonationDocument } from './schemas/donation.schema';
import { PaymentStatus } from '../payments/models';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import { InstitutionStaffMembershipStatus } from '../institution-staff-memberships/models';
import {
  TaxReceipt,
  TaxReceiptDocument,
} from '../tax-receipts/schemas/tax-receipt.schema';
import { TaxReceiptsService } from '../tax-receipts/tax-receipts.service';

@Injectable()
export class DonationsService {
  constructor(
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(TaxReceipt.name)
    private readonly taxReceiptModel: Model<TaxReceiptDocument>,
  ) {}

  private formatCurrency(value: number) {
    return `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
  }

  private toAppStatus(status?: DonationStatus) {
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

    return status ? (statusMap[status] ?? 'pending') : 'pending';
  }

  private async enrichDonation(donation: DonationDocument | any) {
    const [campaign, institution, payment] = await Promise.all([
      this.campaignModel.findById(donation.campaignId).lean().exec(),
      this.institutionModel.findById(donation.institutionId).lean().exec(),
      this.paymentModel
        .findOne({ donationId: donation._id })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);
    const receipt = payment
      ? await this.taxReceiptModel
          .findOne({ 'metadata.paymentId': payment._id.toString() })
          .lean()
          .exec()
      : undefined;
    const gatewayPayload = payment?.gatewayPayload ?? {};
    const amountCents = donation.moneyDonation?.amount
      ? Math.round(donation.moneyDonation.amount * 100)
      : 0;
    const serviceFeeAmount = Number(gatewayPayload.serviceFeeAmount ?? 0);
    const subscriptionStatus = String(gatewayPayload.subscriptionStatus ?? '');
    const subscriptionId = gatewayPayload.subscriptionId
      ? String(gatewayPayload.subscriptionId)
      : undefined;
    const subscriptionCanceledAt = gatewayPayload.subscriptionCanceledAt
      ? String(gatewayPayload.subscriptionCanceledAt)
      : undefined;

    return {
      id: donation._id?.toString() ?? donation.id,
      campaignId: donation.campaignId?.toString() ?? donation.campaignId,
      campaignTitle: campaign?.title ?? 'Campanha',
      institutionName:
        institution?.displayName || institution?.legalName || 'Instituição',
      amountCents,
      amountFormatted: this.formatCurrency(amountCents),
      donationKind:
        gatewayPayload.donationKind === 'monthly' ? 'monthly' : 'single',
      netAmountCents: Math.max(amountCents - serviceFeeAmount, 0),
      netAmountFormatted: this.formatCurrency(
        Math.max(amountCents - serviceFeeAmount, 0),
      ),
      paymentId: payment?._id?.toString(),
      receiptId: receipt?._id?.toString(),
      receiptNumber: receipt?.receiptNumber,
      receiptUrl: receipt?._id
        ? TaxReceiptsService.createPdfDownloadPath(receipt._id.toString())
        : undefined,
      serviceFeeAmount,
      serviceFeeBps: Number(gatewayPayload.serviceFeeBps ?? 0),
      serviceFeeFormatted: this.formatCurrency(serviceFeeAmount),
      status: this.toAppStatus(donation.status),
      subscriptionCanceledAt,
      subscriptionId,
      subscriptionStatus:
        subscriptionCanceledAt || subscriptionStatus === 'canceled'
          ? 'canceled'
          : subscriptionId && payment?.status !== PaymentStatus.FAILED
            ? subscriptionStatus || 'active'
            : undefined,
      createdAt: donation.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  private async ensureSeedData() {
    const existingCount = await this.donationModel.countDocuments().exec();

    if (existingCount > 0) {
      return;
    }

    const [campaign, institution] = await Promise.all([
      this.campaignModel.findOne().lean().exec(),
      this.institutionModel.findOne().lean().exec(),
    ]);

    if (!campaign || !institution) {
      return;
    }

    await this.donationModel.create([
      {
        donorUserId: new Types.ObjectId(),
        institutionId: institution._id,
        campaignId: campaign._id,
        type: DonationType.MONEY,
        status: DonationStatus.PAID,
        visibility: DonationVisibility.PUBLIC,
        moneyDonation: { amount: 80, currency: 'BRL' },
        deliveryMode: DonationDeliveryMode.INSTANT_ONLINE,
        receiptEligible: true,
      },
    ]);
  }

  async create(createDonationDto: CreateDonationDto, donorUserId?: string) {
    await this.ensureSeedData();

    const toObjectId = (value?: string) => {
      if (!value) {
        return undefined;
      }

      try {
        return new Types.ObjectId(value);
      } catch {
        return value;
      }
    };

    const amountCents =
      createDonationDto.amountCents ??
      (createDonationDto.moneyDonation?.amount
        ? Math.round(createDonationDto.moneyDonation.amount * 100)
        : 0);
    const campaignId = createDonationDto.campaignId
      ? toObjectId(createDonationDto.campaignId.toString())
      : undefined;

    if (!campaignId) {
      throw new BadRequestException('campaignId is required');
    }

    if (amountCents <= 0) {
      throw new BadRequestException('amountCents must be greater than zero');
    }

    const campaign = await this.campaignModel
      .findById(campaignId)
      .lean()
      .exec();

    if (!campaign) {
      throw new NotFoundException(
        `Campanha ${createDonationDto.campaignId} não encontrada.`,
      );
    }

    const donation = await this.donationModel.create({
      donorUserId: donorUserId ? toObjectId(donorUserId) : new Types.ObjectId(),
      institutionId: campaign.institutionId,
      campaignId,
      type: DonationType.MONEY,
      status: DonationStatus.PENDING_PAYMENT,
      visibility: DonationVisibility.PUBLIC,
      moneyDonation: { amount: amountCents / 100, currency: 'BRL' },
      deliveryMode: DonationDeliveryMode.INSTANT_ONLINE,
      receiptEligible: true,
    });

    await this.campaignModel
      .findByIdAndUpdate(campaignId, {
        $inc: {
          'progress.moneyRaised': amountCents / 100,
          'stats.donationsCount': 1,
        },
      })
      .exec();

    return { donation: await this.enrichDonation(donation) };
  }

  async findAll(query: PaginationQuery = {}) {
    await this.ensureSeedData();
    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const donations = await this.donationModel
      .find()
      .sort({ createdAt: -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .lean()
      .exec();
    const items = await Promise.all(
      donations.map((donation) => this.enrichDonation(donation)),
    );

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.donationModel.countDocuments().exec();
    return paginatedResponse(items, total, pagination);
  }

  async findMyDonations(donorUserId?: string, query: PaginationQuery = {}) {
    await this.ensureSeedData();
    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const filter = donorUserId
      ? { donorUserId: new Types.ObjectId(donorUserId) }
      : {};
    const donations = await this.donationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .lean()
      .exec();
    const items = await Promise.all(
      donations.map((donation) => this.enrichDonation(donation)),
    );

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.donationModel.countDocuments(filter).exec();
    return paginatedResponse(items, total, pagination);
  }

  async findMyInstitutionDonations(userId?: string, query: PaginationQuery = {}) {
    await this.ensureSeedData();

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return [];
    }

    const memberships = await this.institutionStaffMembershipModel
      .find({
        userId: new Types.ObjectId(userId),
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .lean()
      .exec();
    const institutionIds = memberships.map(
      (membership) => membership.institutionId,
    );

    if (institutionIds.length === 0) {
      return [];
    }

    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const filter = { institutionId: { $in: institutionIds } };
    const donations = await this.donationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .lean()
      .exec();

    const items = await Promise.all(
      donations.map((donation) => this.enrichDonation(donation)),
    );

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.donationModel.countDocuments(filter).exec();
    return paginatedResponse(items, total, pagination);
  }

  async findOne(id: string) {
    await this.ensureSeedData();
    const donation = await this.donationModel.findById(id).lean().exec();

    if (!donation) {
      throw new NotFoundException(`Doação ${id} não encontrada.`);
    }

    return this.enrichDonation(donation);
  }

  update(id: string, updateDonationDto: UpdateDonationDto) {
    return this.donationModel
      .findByIdAndUpdate(id, updateDonationDto, { returnDocument: 'after' })
      .exec();
  }

  remove(id: string) {
    return this.donationModel.findByIdAndDelete(id).exec();
  }
}
