import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditLog, AuditLogDocument } from '../audit-logs/schemas/audit-log.schema';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { CampaignStatus } from '../campaigns/models';
import { InstitutionDonationType, InstitutionStatus } from './models';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { Institution, InstitutionDocument } from './schemas/institution.schema';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name) private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
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

  private mapCampaignCategory(campaign: CampaignDocument | any) {
    return this.toAppCategory(campaign?.acceptedItems?.[0]?.category?.toString());
  }

  private toAppCampaign(campaign: CampaignDocument | any, institutionName: string) {
    const goalCents = Number(campaign?.goal?.moneyTarget ?? 0) * 100;
    const raisedCents = Number(campaign?.progress?.moneyRaised ?? 0) * 100;
    const progress = goalCents > 0 ? Math.min(100, Math.round((raisedCents / goalCents) * 100)) : 0;
    const active = campaign?.status === CampaignStatus.PUBLISHED && (!campaign?.endAt || new Date(campaign.endAt) >= new Date());

    return {
      id: campaign._id?.toString() ?? campaign.id,
      title: campaign.title,
      institution: institutionName,
      institutionId: campaign.institutionId?.toString() ?? '',
      category: this.mapCampaignCategory(campaign),
      goalFormatted: this.formatCurrency(goalCents),
      raisedFormatted: this.formatCurrency(raisedCents),
      goalCents,
      raisedCents,
      progress,
      active,
      endsAt: campaign.endAt ? new Date(campaign.endAt).toISOString().slice(0, 10) : undefined,
    };
  }

  private toAppInstitution(institution: InstitutionDocument | any) {
    return {
      id: institution._id?.toString() ?? institution.id,
      name: institution.displayName || institution.legalName,
      category: 'Outros',
      city: institution.address?.city ?? 'São Paulo',
      state: institution.address?.state ?? 'SP',
      activeCampaigns: institution.stats?.campaignsCount ?? 0,
      verified: institution.verification?.isVerified ?? false,
      description: institution.description ?? 'Descrição indisponível.',
    };
  }

  private async ensureSeedData() {
    const existingCount = await this.institutionModel.countDocuments().exec();

    if (existingCount > 0) {
      return;
    }

    await this.institutionModel.create([
      {
        legalName: 'Educação Viva',
        displayName: 'Educação Viva',
        cnpj: '00000000000100',
        email: 'contato@educacaoviva.org.br',
        description: 'Promovemos acesso à educação de qualidade para crianças em situação de vulnerabilidade.',
        status: InstitutionStatus.ACTIVE,
        verification: { isVerified: true },
        address: { city: 'São Paulo', state: 'SP' },
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
        address: { city: 'Curitiba', state: 'PR' },
        acceptedDonationTypes: [InstitutionDonationType.MONEY],
        taxReceiptEnabled: true,
      },
    ]);
  }

  async create(createInstitutionDto: CreateInstitutionDto) {
    await this.ensureSeedData();
    return this.institutionModel.create(createInstitutionDto);
  }

  async findAll() {
    await this.ensureSeedData();
    const institutions = await this.institutionModel.find().sort({ createdAt: -1 }).lean().exec();
    return institutions.map((institution) => this.toAppInstitution(institution));
  }

  async findPending() {
    const institutions = await this.institutionModel
      .find({ status: InstitutionStatus.PENDING_APPROVAL })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return institutions.map((institution) => ({
      ...this.toAppInstitution(institution),
      cnpj: institution.cnpj,
      email: institution.email,
      phone: institution.phone,
      website: institution.website,
      status: institution.status,
      createdAt: institution.createdAt?.toISOString?.() ?? institution.createdAt,
    }));
  }

  async findAllForAdmin() {
    const institutions = await this.institutionModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return institutions.map((institution) => ({
      ...this.toAppInstitution(institution),
      cnpj: institution.cnpj,
      email: institution.email,
      phone: institution.phone,
      website: institution.website,
      status: institution.status,
      createdAt: institution.createdAt?.toISOString?.() ?? institution.createdAt,
    }));
  }

  async findOne(id: string) {
    await this.ensureSeedData();
    const institution = await this.institutionModel.findById(id).lean().exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    const campaigns = await this.campaignModel.find({ institutionId: institution._id }).sort({ createdAt: -1 }).lean().exec();
    const institutionName = institution.displayName || institution.legalName;

    return {
      ...this.toAppInstitution(institution),
      foundedYear: 2010,
      email: institution.email,
      website: institution.website ?? undefined,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === CampaignStatus.PUBLISHED).length,
      campaigns: campaigns.map((campaign) => this.toAppCampaign(campaign, institutionName)),
    };
  }

  update(id: string, updateInstitutionDto: UpdateInstitutionDto) {
    return this.institutionModel.findByIdAndUpdate(id, updateInstitutionDto, { new: true }).exec();
  }

  async approve(id: string, actorUserId?: string) {
    const institution = await this.institutionModel
      .findByIdAndUpdate(
        id,
        {
          status: InstitutionStatus.ACTIVE,
          verification: {
            isVerified: true,
            verifiedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    await this.auditLogModel.create({
      actorUserId: actorUserId && Types.ObjectId.isValid(actorUserId) ? new Types.ObjectId(actorUserId) : undefined,
      action: 'institution.approve',
      targetType: 'institution',
      targetId: institution._id,
      metadata: { institutionName: institution.displayName || institution.legalName },
    });

    return {
      ...this.toAppInstitution(institution),
      cnpj: institution.cnpj,
      email: institution.email,
      status: institution.status,
    };
  }

  async reject(id: string, actorUserId?: string) {
    const institution = await this.institutionModel
      .findByIdAndUpdate(id, { status: InstitutionStatus.REJECTED }, { new: true })
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    await this.auditLogModel.create({
      actorUserId: actorUserId && Types.ObjectId.isValid(actorUserId) ? new Types.ObjectId(actorUserId) : undefined,
      action: 'institution.reject',
      targetType: 'institution',
      targetId: institution._id,
      metadata: { institutionName: institution.displayName || institution.legalName },
    });

    return {
      ...this.toAppInstitution(institution),
      cnpj: institution.cnpj,
      email: institution.email,
      status: institution.status,
    };
  }

  remove(id: string) {
    return this.institutionModel.findByIdAndDelete(id).exec();
  }
}
