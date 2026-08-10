import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { env } from '../../config/env';
import {
  AuditLog,
  AuditLogDocument,
} from '../audit-logs/schemas/audit-log.schema';
import {
  Campaign,
  CampaignDocument,
} from '../campaigns/schemas/campaign.schema';
import { CampaignStatus } from '../campaigns/models';
import { InstitutionStaffMembershipStatus } from '../institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import { InstitutionDonationType, InstitutionStatus } from './models';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { VerifyStripeConnectAccountDto } from './dto/verify-stripe-connect-account.dto';
import { Institution, InstitutionDocument } from './schemas/institution.schema';

@Injectable()
export class InstitutionsService {
  private stripeClient?: Stripe;

  constructor(
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
  ) {}

  private getStripeClient() {
    if (!env.stripeSecretKey) {
      throw new ServiceUnavailableException('Stripe não está configurada.');
    }

    this.stripeClient ??= new Stripe(env.stripeSecretKey, {
      appInfo: {
        name: env.serviceName,
        version: env.serviceVersion,
      },
    });

    return this.stripeClient;
  }

  private assertValidStripeConnectAccountId(accountId?: string) {
    const normalizedAccountId = accountId?.toLowerCase() ?? '';

    if (
      !accountId ||
      !/^acct_[A-Za-z0-9]+$/.test(accountId) ||
      normalizedAccountId.includes('seu_id') ||
      normalizedAccountId.includes('teste') ||
      normalizedAccountId.includes('test') ||
      normalizedAccountId.includes('example')
    ) {
      throw new BadRequestException(
        'Informe um ID real de conta conectada Stripe no formato acct_...',
      );
    }
  }

  private async assertStripeConnectAccountIsAvailable(
    institutionId: string,
    accountId: string,
  ) {
    const existingInstitution = await this.institutionModel
      .findOne({
        _id: { $ne: new Types.ObjectId(institutionId) },
        $or: [
          { stripeConnectAccountId: accountId },
          { 'stripeConnect.accountId': accountId },
        ],
      })
      .select({ _id: 1, name: 1 })
      .lean()
      .exec();

    if (existingInstitution) {
      throw new BadRequestException(
        'Essa conta Stripe já está vinculada a outra instituição.',
      );
    }
  }

  private async assertActiveInstitutionMembership(
    institutionId: string,
    userId?: string,
  ) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Usuário autenticado inválido.');
    }

    if (!Types.ObjectId.isValid(institutionId)) {
      throw new BadRequestException('Instituição inválida.');
    }

    const membership = await this.institutionStaffMembershipModel
      .exists({
        institutionId: new Types.ObjectId(institutionId),
        userId: new Types.ObjectId(userId),
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .exec();

    if (!membership) {
      throw new ForbiddenException(
        'Usuário não possui vínculo ativo com esta instituição.',
      );
    }
  }

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

    return category ? (categoryMap[category] ?? 'Outros') : 'Outros';
  }

  private mapCampaignCategory(campaign: CampaignDocument | any) {
    return this.toAppCategory(
      campaign?.acceptedItems?.[0]?.category?.toString(),
    );
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

  private toAppStripeConnect(institution: InstitutionDocument | any) {
    const stripeConnect = institution.stripeConnect;
    const legacyAccountId = institution.stripeConnectAccountId;

    if (!stripeConnect && !legacyAccountId) {
      return {
        ready: false,
        status: 'missing',
      };
    }

    if (!stripeConnect) {
      return {
        accountId: legacyAccountId,
        ready: false,
        status: 'not_verified',
      };
    }

    return {
      accountId: stripeConnect.accountId ?? legacyAccountId,
      chargesEnabled: Boolean(stripeConnect.chargesEnabled),
      country: stripeConnect.country,
      defaultCurrency: stripeConnect.defaultCurrency,
      detailsSubmitted: Boolean(stripeConnect.detailsSubmitted),
      exists: Boolean(stripeConnect.exists),
      livemode: Boolean(stripeConnect.livemode),
      payoutsEnabled: Boolean(stripeConnect.payoutsEnabled),
      ready: Boolean(stripeConnect.ready),
      requirementsCurrentlyDue: stripeConnect.requirementsCurrentlyDue ?? [],
      requirementsDisabledReason: stripeConnect.requirementsDisabledReason,
      status: stripeConnect.ready ? 'ready' : 'pending',
      verifiedAt:
        stripeConnect.verifiedAt?.toISOString?.() ?? stripeConnect.verifiedAt,
    };
  }

  private resolveCampaignLocation(
    campaign: CampaignDocument | any,
    institution: InstitutionDocument | any,
  ) {
    return (
      this.toAppLocation(campaign?.address?.location) ??
      this.toAppLocation(institution?.address?.location)
    );
  }

  private toAppCampaign(
    campaign: CampaignDocument | any,
    institution: InstitutionDocument | any,
  ) {
    const goalCents = Number(campaign?.goal?.moneyTarget ?? 0) * 100;
    const raisedCents = Number(campaign?.progress?.moneyRaised ?? 0) * 100;
    const progress =
      goalCents > 0
        ? Math.min(100, Math.round((raisedCents / goalCents) * 100))
        : 0;
    const active =
      campaign?.status === CampaignStatus.PUBLISHED &&
      (!campaign?.endAt || new Date(campaign.endAt) >= new Date());
    const institutionName =
      institution?.displayName || institution?.legalName || 'Instituição';

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
      endsAt: campaign.endAt
        ? new Date(campaign.endAt).toISOString().slice(0, 10)
        : undefined,
      acceptsRecurringDonations: Boolean(
        institution?.acceptsRecurringDonations,
      ),
      location: this.resolveCampaignLocation(campaign, institution),
    };
  }

  private toAppInstitution(institution: InstitutionDocument | any) {
    const location = this.toAppLocation(institution.address?.location);

    return {
      id: institution._id?.toString() ?? institution.id,
      name: institution.displayName || institution.legalName,
      category: 'Outros',
      city: institution.address?.city ?? 'São Paulo',
      state: institution.address?.state ?? 'SP',
      activeCampaigns: institution.stats?.campaignsCount ?? 0,
      followersCount: institution.stats?.followersCount ?? 0,
      postsCount: institution.stats?.postsCount ?? 0,
      receivedDonationsCount: institution.stats?.receivedDonationsCount ?? 0,
      receivedAmount: institution.stats?.receivedAmount ?? 0,
      verified: institution.verification?.isVerified ?? false,
      description: institution.description ?? 'Descrição indisponível.',
      acceptsRecurringDonations: Boolean(institution.acceptsRecurringDonations),
      stripeConnect: this.toAppStripeConnect(institution),
      stripeConnectAccountId: institution.stripeConnectAccountId,
      location,
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
        description:
          'Promovemos acesso à educação de qualidade para crianças em situação de vulnerabilidade.',
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
        description:
          'Distribuímos cestas básicas e refeições para famílias em insegurança alimentar.',
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

  async create(createInstitutionDto: CreateInstitutionDto) {
    await this.ensureSeedData();
    return this.institutionModel.create(createInstitutionDto);
  }

  async findAll() {
    await this.ensureSeedData();
    const institutions = await this.institutionModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return institutions.map((institution) =>
      this.toAppInstitution(institution),
    );
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
      createdAt:
        institution.createdAt?.toISOString?.() ?? institution.createdAt,
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
      createdAt:
        institution.createdAt?.toISOString?.() ?? institution.createdAt,
    }));
  }

  async findOne(id: string) {
    await this.ensureSeedData();
    const institution = await this.institutionModel.findById(id).lean().exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    const campaigns = await this.campaignModel
      .find({ institutionId: institution._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      ...this.toAppInstitution(institution),
      foundedYear: 2010,
      email: institution.email,
      stripeConnectAccountId: institution.stripeConnectAccountId,
      website: institution.website ?? undefined,
      activeCampaigns: campaigns.filter(
        (campaign) => campaign.status === CampaignStatus.PUBLISHED,
      ).length,
      campaigns: campaigns.map((campaign) =>
        this.toAppCampaign(campaign, institution),
      ),
    };
  }

  async verifyStripeConnectAccount(
    id: string,
    verifyStripeConnectAccountDto: VerifyStripeConnectAccountDto,
    userId?: string,
  ) {
    await this.assertActiveInstitutionMembership(id, userId);
    this.assertValidStripeConnectAccountId(
      verifyStripeConnectAccountDto.stripeConnectAccountId,
    );

    const accountId = verifyStripeConnectAccountDto.stripeConnectAccountId;
    await this.assertStripeConnectAccountIsAvailable(id, accountId);

    const stripe = this.getStripeClient();
    let account: Stripe.Account;

    try {
      const retrievedAccount = await stripe.accounts.retrieve(accountId);

      if ('deleted' in retrievedAccount && retrievedAccount.deleted) {
        throw new BadRequestException('A conta Stripe informada foi removida.');
      }

      account = retrievedAccount as Stripe.Account;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Não foi possível validar essa conta Stripe. Confira se o ID começa com acct_, se a conta existe no mesmo ambiente da sua chave Stripe e se ela está conectada à plataforma EloDoar.',
      );
    }

    const requirementsCurrentlyDue =
      account.requirements?.currently_due?.filter(Boolean) ?? [];
    const ready = Boolean(account.charges_enabled && account.details_submitted);

    const updatedInstitution = await this.institutionModel
      .findByIdAndUpdate(
        id,
        {
          stripeConnectAccountId: account.id,
          stripeConnect: {
            accountId: account.id,
            chargesEnabled: Boolean(account.charges_enabled),
            country: account.country,
            defaultCurrency: account.default_currency,
            detailsSubmitted: Boolean(account.details_submitted),
            exists: true,
            livemode: env.stripeSecretKey.startsWith('sk_live_'),
            payoutsEnabled: Boolean(account.payouts_enabled),
            ready,
            requirementsCurrentlyDue,
            requirementsDisabledReason: account.requirements?.disabled_reason,
            verifiedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!updatedInstitution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    return this.findOne(updatedInstitution._id.toString());
  }

  update(id: string, updateInstitutionDto: UpdateInstitutionDto) {
    return this.institutionModel
      .findByIdAndUpdate(id, updateInstitutionDto, { returnDocument: 'after' })
      .exec();
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
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    await this.auditLogModel.create({
      actorUserId:
        actorUserId && Types.ObjectId.isValid(actorUserId)
          ? new Types.ObjectId(actorUserId)
          : undefined,
      action: 'institution.approve',
      targetType: 'institution',
      targetId: institution._id,
      metadata: {
        institutionName: institution.displayName || institution.legalName,
      },
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
      .findByIdAndUpdate(
        id,
        { status: InstitutionStatus.REJECTED },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException(`Instituição ${id} não encontrada.`);
    }

    await this.auditLogModel.create({
      actorUserId:
        actorUserId && Types.ObjectId.isValid(actorUserId)
          ? new Types.ObjectId(actorUserId)
          : undefined,
      action: 'institution.reject',
      targetType: 'institution',
      targetId: institution._id,
      metadata: {
        institutionName: institution.displayName || institution.legalName,
      },
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
