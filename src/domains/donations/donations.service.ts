import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema';
import { DonationDeliveryMode, DonationStatus, DonationType, DonationVisibility } from './models';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { Donation, DonationDocument } from './schemas/donation.schema';

@Injectable()
export class DonationsService {
  constructor(
    @InjectModel(Donation.name) private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
  ) { }

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

    return status ? statusMap[status] ?? 'pending' : 'pending';
  }

  private async enrichDonation(donation: DonationDocument | any) {
    const [campaign, institution] = await Promise.all([
      this.campaignModel.findById(donation.campaignId).lean().exec(),
      this.institutionModel.findById(donation.institutionId).lean().exec(),
    ]);

    return {
      id: donation._id?.toString() ?? donation.id,
      campaignId: donation.campaignId?.toString() ?? donation.campaignId,
      campaignTitle: campaign?.title ?? 'Campanha',
      institutionName: institution?.displayName || institution?.legalName || 'Instituição',
      amountCents: donation.moneyDonation?.amount ? Math.round(donation.moneyDonation.amount * 100) : 0,
      amountFormatted: this.formatCurrency(donation.moneyDonation?.amount ? Math.round(donation.moneyDonation.amount * 100) : 0),
      status: this.toAppStatus(donation.status),
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

    const amountCents = createDonationDto.amountCents ?? (
      createDonationDto.moneyDonation?.amount ? Math.round(createDonationDto.moneyDonation.amount * 100) : 0
    );
    const campaignId = createDonationDto.campaignId ? toObjectId(createDonationDto.campaignId.toString()) : undefined;

    if (!campaignId) {
      throw new BadRequestException('campaignId is required');
    }

    if (amountCents <= 0) {
      throw new BadRequestException('amountCents must be greater than zero');
    }

    const campaign = await this.campaignModel.findById(campaignId).lean().exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${createDonationDto.campaignId} não encontrada.`);
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

  async findAll() {
    await this.ensureSeedData();
    const donations = await this.donationModel.find().sort({ createdAt: -1 }).lean().exec();
    return Promise.all(donations.map((donation) => this.enrichDonation(donation)));
  }

  async findMyDonations(donorUserId?: string) {
    await this.ensureSeedData();
    const query = donorUserId ? { donorUserId: new Types.ObjectId(donorUserId) } : {};
    const donations = await this.donationModel.find(query).sort({ createdAt: -1 }).lean().exec();
    return Promise.all(donations.map((donation) => this.enrichDonation(donation)));
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
    return this.donationModel.findByIdAndUpdate(id, updateDonationDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.donationModel.findByIdAndDelete(id).exec();
  }
}
