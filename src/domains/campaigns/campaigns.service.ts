import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { InstitutionDonationType, InstitutionStatus } from '../institutions/models';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema';
import { CampaignStatus, CampaignDonationType, CampaignVisibility } from './models';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
  ) { }

  private formatCurrency(value: number) {
    return `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
  }

  private toAppCategory(category?: string) {
    const categoryMap: Record<string, string> = {
      FOOD: 'Alimentação',
      CLOTHES: 'Outros',
      HYGIENE: 'Saúde',
      TOYS: 'Outros',
      OTHER: 'Outros',
    };

    return category ? categoryMap[category] ?? 'Outros' : 'Outros';
  }

  private mapCategory(campaign: CampaignDocument) {
    return this.toAppCategory(campaign?.acceptedItems?.[0]?.category?.toString());
  }

  private toAppLocation(location?: { coordinates?: unknown }) {
    const coordinates = location?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return undefined;
    }

    const [longitude, latitude] = coordinates.map(Number);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return undefined;
    }

    return { latitude, longitude };
  }

  private resolveCampaignLocation(campaign: CampaignDocument | any, institution?: InstitutionDocument | any) {
    return (
      this.toAppLocation(campaign?.address?.location) ??
      this.toAppLocation(institution?.address?.location)
    );
  }

  private toAppCampaign(campaign: CampaignDocument | any, institution?: InstitutionDocument | any) {
    const goalCents = Number(campaign?.goal?.moneyTarget ?? 0) * 100;
    const raisedCents = Number(campaign?.progress?.moneyRaised ?? 0) * 100;
    const progress = goalCents > 0 ? Math.min(100, Math.round((raisedCents / goalCents) * 100)) : 0;
    const active = campaign?.status === CampaignStatus.PUBLISHED && (!campaign?.endAt || new Date(campaign.endAt) >= new Date());
    const location = this.resolveCampaignLocation(campaign, institution);

    return {
      id: campaign._id?.toString() ?? campaign.id,
      title: campaign.title,
      institution: institution?.displayName ?? institution?.legalName ?? campaign.institutionName ?? 'Instituição',
      institutionId: campaign.institutionId?.toString() ?? '',
      category: this.mapCategory(campaign),
      goalFormatted: this.formatCurrency(goalCents),
      raisedFormatted: this.formatCurrency(raisedCents),
      goalCents,
      raisedCents,
      progress,
      active,
      endsAt: campaign.endAt ? new Date(campaign.endAt).toISOString().slice(0, 10) : undefined,
      location,
    };
  }

  private async ensureSeedData() {
    const existingCount = await this.campaignModel.countDocuments().exec();

    if (existingCount > 0) {
      return;
    }

    const institutionCount = await this.institutionModel.countDocuments().exec();

    if (institutionCount === 0) {
      await this.institutionModel.create([
        {
          legalName: 'Educação Viva',
          displayName: 'Educação Viva',
          cnpj: '00000000000100',
          email: 'contato@educacaoviva.org.br',
          description: 'Promovemos acesso à educação de qualidade para crianças em situação de vulnerabilidade.',
          status: InstitutionStatus.ACTIVE,
          verification: { isVerified: true },
          address: {
            city: 'São Paulo',
            state: 'SP',
            location: { type: 'Point', coordinates: [-46.6333, -23.5505] },
          },
          acceptedDonationTypes: [InstitutionDonationType.MONEY],
          taxReceiptEnabled: true,
        },
        {
          legalName: 'Lar Aconchego',
          displayName: 'Lar Aconchego',
          cnpj: '00000000000200',
          email: 'contato@laraconchego.org.br',
          description: 'Distribuímos cestas básicas e refeições para famílias em insegurança alimentar.',
          status: InstitutionStatus.ACTIVE,
          verification: { isVerified: true },
          address: {
            city: 'Curitiba',
            state: 'PR',
            location: { type: 'Point', coordinates: [-49.2733, -25.4284] },
          },
          acceptedDonationTypes: [InstitutionDonationType.MONEY],
          taxReceiptEnabled: true,
        },
      ]);
    }

    const institutions = await this.institutionModel.find().lean().exec();
    const institutionMap = new Map(institutions.map((institution) => [institution._id.toString(), institution]));

    const seedCampaigns = [
      {
        title: 'Material Escolar 2026',
        description: 'Campanha para fornecer material escolar completo para crianças de periferia.',
        institutionId: institutions[0]?._id,
        createdByUserId: new Types.ObjectId(),
        status: CampaignStatus.PUBLISHED,
        donationTypes: [CampaignDonationType.MONEY],
        goal: { moneyTarget: 5000, itemsTarget: 0 },
        progress: { moneyRaised: 3200, itemsRaised: 0 },
        visibility: CampaignVisibility.PUBLIC,
        endAt: new Date('2026-07-31T00:00:00.000Z'),
      },
      {
        title: 'Cestas de Inverno',
        description: 'Distribuímos cestas básicas para famílias em insegurança alimentar.',
        institutionId: institutions[1]?._id ?? institutions[0]?._id,
        createdByUserId: new Types.ObjectId(),
        status: CampaignStatus.PUBLISHED,
        donationTypes: [CampaignDonationType.MONEY],
        goal: { moneyTarget: 8000, itemsTarget: 0 },
        progress: { moneyRaised: 5600, itemsRaised: 0 },
        visibility: CampaignVisibility.PUBLIC,
        endAt: new Date('2026-08-15T00:00:00.000Z'),
      },
    ];

    await this.campaignModel.create(seedCampaigns);
    institutionMap.clear();
  }

  async create(createCampaignDto: CreateCampaignDto) {
    await this.ensureSeedData();
    return this.campaignModel.create(createCampaignDto);
  }

  async findAll() {
    await this.ensureSeedData();
    const campaigns = await this.campaignModel.find().sort({ createdAt: -1 }).lean().exec();
    const institutionIds = campaigns
      .map((campaign) => campaign.institutionId?.toString())
      .filter((value): value is string => Boolean(value));
    const institutions = await this.institutionModel
      .find({ _id: { $in: institutionIds } })
      .lean()
      .exec();
    const institutionMap = new Map(institutions.map((institution) => [institution._id.toString(), institution]));

    return campaigns.map((campaign) =>
      this.toAppCampaign(campaign, institutionMap.get(campaign.institutionId?.toString() ?? '')),
    );
  }

  async findOne(id: string) {
    await this.ensureSeedData();
    const campaign = await this.campaignModel.findById(id).lean().exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    const institution = await this.institutionModel.findById(campaign.institutionId).lean().exec();

    return {
      ...this.toAppCampaign(campaign, institution),
      description: campaign.description ?? 'Descrição da campanha indisponível.',
      donorsCount: campaign.stats?.donationsCount ?? 0,
      itemsNeeded: campaign.acceptedItems?.map((item: any) => item.name) ?? [],
    };
  }

  update(id: string, updateCampaignDto: UpdateCampaignDto) {
    return this.campaignModel.findByIdAndUpdate(id, updateCampaignDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.campaignModel.findByIdAndDelete(id).exec();
  }
}
