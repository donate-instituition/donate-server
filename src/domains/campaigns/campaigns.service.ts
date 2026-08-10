import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';

import {
  getPaginationOptions,
  paginatedResponse,
  type PaginationQuery,
  shouldPaginate,
} from '../../common/pagination';
import { ObjectStorageService } from '../../storage/object-storage.service';
import {
  InstitutionStaffMembershipRole,
  InstitutionStaffMembershipStatus,
} from '../institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import {
  InstitutionDonationType,
  InstitutionStatus,
} from '../institutions/models';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CampaignStatus,
  CampaignDonationType,
  CampaignVisibility,
} from './models';
import {
  CampaignComment,
  CampaignCommentDocument,
} from './schemas/campaign-comment.schema';
import {
  CampaignReaction,
  CampaignReactionDocument,
} from './schemas/campaign-reaction.schema';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UploadCampaignAssetDto } from './dto/upload-campaign-asset.dto';

@Injectable()
export class CampaignsService {
  private readonly campaignPublisherRoles = new Set([
    InstitutionStaffMembershipRole.OWNER,
    InstitutionStaffMembershipRole.ADMIN,
    InstitutionStaffMembershipRole.MANAGER,
  ]);

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignComment.name)
    private readonly campaignCommentModel: Model<CampaignCommentDocument>,
    @InjectModel(CampaignReaction.name)
    private readonly campaignReactionModel: Model<CampaignReactionDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  private formatCurrency(value: number) {
    return `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
  }

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido.');
    }

    return new Types.ObjectId(id);
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

  private mapCategory(campaign: CampaignDocument) {
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

  private resolveCampaignLocation(
    campaign: CampaignDocument | any,
    institution?: InstitutionDocument | any,
  ) {
    return (
      this.toAppLocation(campaign?.address?.location) ??
      this.toAppLocation(institution?.address?.location)
    );
  }

  private toAppCampaign(
    campaign: CampaignDocument | any,
    institution?: InstitutionDocument | any,
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
    const location = this.resolveCampaignLocation(campaign, institution);

    return {
      id: campaign._id?.toString() ?? campaign.id,
      title: campaign.title,
      institution:
        institution?.displayName ??
        institution?.legalName ??
        campaign.institutionName ??
        'Instituição',
      institutionId: campaign.institutionId?.toString() ?? '',
      category: this.mapCategory(campaign),
      bannerUrl: campaign.bannerUrl,
      status: campaign?.status,
      goalFormatted: this.formatCurrency(goalCents),
      raisedFormatted: this.formatCurrency(raisedCents),
      goalCents,
      raisedCents,
      progress,
      donationsCount: campaign.stats?.donationsCount ?? 0,
      followersCount: campaign.stats?.followersCount ?? 0,
      likesCount: campaign.stats?.likesCount ?? 0,
      commentsCount: campaign.stats?.commentsCount ?? 0,
      sharesCount: campaign.stats?.sharesCount ?? 0,
      postsCount: campaign.stats?.postsCount ?? 0,
      active,
      endsAt: campaign.endAt
        ? new Date(campaign.endAt).toISOString().slice(0, 10)
        : undefined,
      acceptsRecurringDonations: Boolean(
        institution?.acceptsRecurringDonations,
      ),
      location,
    };
  }

  private async ensureSeedData() {
    const existingCount = await this.campaignModel.countDocuments().exec();

    if (existingCount > 0) {
      return;
    }

    const institutionCount = await this.institutionModel
      .countDocuments()
      .exec();

    if (institutionCount === 0) {
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

    const institutions = await this.institutionModel.find().lean().exec();
    const institutionMap = new Map(
      institutions.map((institution) => [
        institution._id.toString(),
        institution,
      ]),
    );

    const seedCampaigns = [
      {
        title: 'Material Escolar 2026',
        description:
          'Campanha para fornecer material escolar completo para crianças de periferia.',
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
        description:
          'Distribuímos cestas básicas para famílias em insegurança alimentar.',
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

  private async findActiveMembership(userId?: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Usuário autenticado inválido.');
    }

    const membership = await this.institutionStaffMembershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    if (!membership) {
      throw new ForbiddenException(
        'Usuário não possui vínculo ativo com uma instituição.',
      );
    }

    return membership;
  }

  private assertInstitutionStripeReady(institution: InstitutionDocument | any) {
    if (!institution?.stripeConnect?.ready) {
      throw new BadRequestException(
        'Configure e valide a conta Stripe Connect da instituição antes de criar campanhas.',
      );
    }
  }

  async createForCurrentInstitution(
    createCampaignDto: Omit<
      CreateCampaignDto,
      'createdByUserId' | 'institutionId'
    >,
    userId?: string,
  ) {
    const membership = await this.findActiveMembership(userId);
    const institution = await this.institutionModel
      .findById(membership.institutionId)
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException('Instituição vinculada não encontrada.');
    }

    this.assertInstitutionStripeReady(institution);

    const donationTypes = createCampaignDto.donationTypes?.length
      ? createCampaignDto.donationTypes
      : [CampaignDonationType.MONEY];

    const requestedStatus =
      createCampaignDto.status ?? CampaignStatus.IN_REVIEW;
    const canPublish = this.campaignPublisherRoles.has(membership.role);
    const nextStatus =
      requestedStatus === CampaignStatus.PUBLISHED && canPublish
        ? CampaignStatus.PUBLISHED
        : CampaignStatus.IN_REVIEW;

    const campaign = await this.campaignModel.create({
      ...createCampaignDto,
      createdByUserId: new Types.ObjectId(userId),
      donationTypes,
      institutionId: membership.institutionId,
      progress: createCampaignDto.progress ?? {
        itemsRaised: 0,
        moneyRaised: 0,
      },
      status: nextStatus,
      visibility: createCampaignDto.visibility ?? CampaignVisibility.PUBLIC,
    });

    return this.findOne(campaign._id.toString());
  }

  async publishForCurrentInstitution(id: string, userId?: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Usuário autenticado inválido.');
    }

    const campaign = await this.campaignModel.findById(id).lean().exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    const institution = await this.institutionModel
      .findById(campaign.institutionId)
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException('Instituição da campanha não encontrada.');
    }

    this.assertInstitutionStripeReady(institution);

    const membership = await this.institutionStaffMembershipModel
      .findOne({
        institutionId: campaign.institutionId,
        userId: new Types.ObjectId(userId),
        status: InstitutionStaffMembershipStatus.ACTIVE,
        role: { $in: Array.from(this.campaignPublisherRoles) },
      })
      .lean()
      .exec();

    if (!membership) {
      throw new ForbiddenException(
        'Apenas administradores da instituição podem publicar campanhas.',
      );
    }

    const updatedCampaign = await this.campaignModel
      .findByIdAndUpdate(
        id,
        { status: CampaignStatus.PUBLISHED },
        { returnDocument: 'after' },
      )
      .exec();

    return this.findOne(updatedCampaign?._id.toString() ?? id);
  }

  async uploadAsset(uploadCampaignAssetDto: UploadCampaignAssetDto) {
    const contentType = uploadCampaignAssetDto.contentType
      ?.trim()
      .toLowerCase();

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(contentType)) {
      throw new BadRequestException('A imagem precisa ser JPG ou PNG.');
    }

    const body = Buffer.from(uploadCampaignAssetDto.base64, 'base64');
    const maxSizeBytes = 5 * 1024 * 1024;

    if (!body.byteLength || body.byteLength > maxSizeBytes) {
      throw new BadRequestException('A imagem precisa ter até 5MB.');
    }

    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `${randomUUID()}.${extension}`;
    const key = `campaign-covers/${fileName}`;

    const storedObject = await this.objectStorageService.putObject({
      body,
      contentDisposition: `inline; filename="${fileName}"`,
      contentType,
      key,
    });

    return {
      contentType: storedObject.contentType,
      fileName,
      key: storedObject.key,
      provider: storedObject.provider,
      size: storedObject.size,
      url: `/campaigns/uploads/${fileName}`,
    };
  }

  getUploadedAssetUrl(fileName: string) {
    if (!/^[a-f0-9-]+\.(jpg|png)$/i.test(fileName)) {
      throw new NotFoundException('Arquivo não encontrado.');
    }

    const contentType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return this.objectStorageService.getSignedDownloadUrl({
      contentType,
      filename: fileName,
      key: `campaign-covers/${fileName}`,
    });
  }

  async findAll(query: PaginationQuery = {}) {
    await this.ensureSeedData();
    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const filter: Record<string, unknown> = {
      status: CampaignStatus.PUBLISHED,
    };

    if (pagination.search) {
      filter.$or = [
        { title: { $regex: pagination.search, $options: 'i' } },
        { description: { $regex: pagination.search, $options: 'i' } },
      ];
    }

    const campaigns = await this.campaignModel
      .find(filter)
      .sort({ createdAt: pagination.sort === 'oldest' ? 1 : -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .lean()
      .exec();
    const institutionIds = campaigns
      .map((campaign) => campaign.institutionId?.toString())
      .filter((value): value is string => Boolean(value));
    const institutions = await this.institutionModel
      .find({ _id: { $in: institutionIds } })
      .lean()
      .exec();
    const institutionMap = new Map(
      institutions.map((institution) => [
        institution._id.toString(),
        institution,
      ]),
    );

    const items = campaigns.map((campaign) =>
      this.toAppCampaign(
        campaign,
        institutionMap.get(campaign.institutionId?.toString() ?? ''),
      ),
    );

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.campaignModel.countDocuments(filter).exec();
    return paginatedResponse(items, total, pagination);
  }

  async findMine(userId?: string, query: PaginationQuery = {}) {
    await this.ensureSeedData();
    const membership = await this.findActiveMembership(userId);
    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const filter: Record<string, unknown> = {
      institutionId: membership.institutionId,
    };

    if (pagination.search) {
      filter.$or = [
        { title: { $regex: pagination.search, $options: 'i' } },
        { description: { $regex: pagination.search, $options: 'i' } },
      ];
    }

    const campaigns = await this.campaignModel
      .find(filter)
      .sort({ createdAt: pagination.sort === 'oldest' ? 1 : -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .lean()
      .exec();
    const institution = await this.institutionModel
      .findById(membership.institutionId)
      .lean()
      .exec();

    const items = campaigns.map((campaign) =>
      this.toAppCampaign(campaign, institution),
    );

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.campaignModel.countDocuments(filter).exec();
    return paginatedResponse(items, total, pagination);
  }

  async findOne(id: string) {
    await this.ensureSeedData();
    const campaign = await this.campaignModel.findById(id).lean().exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    const institution = await this.institutionModel
      .findById(campaign.institutionId)
      .lean()
      .exec();

    return {
      ...this.toAppCampaign(campaign, institution),
      description:
        campaign.description ?? 'Descrição da campanha indisponível.',
      donorsCount: campaign.stats?.donationsCount ?? 0,
      itemsNeeded: campaign.acceptedItems?.map((item: any) => item.name) ?? [],
    };
  }

  update(id: string, updateCampaignDto: UpdateCampaignDto) {
    return this.campaignModel
      .findByIdAndUpdate(id, updateCampaignDto, { returnDocument: 'after' })
      .exec();
  }

  remove(id: string) {
    return this.campaignModel.findByIdAndDelete(id).exec();
  }

  private toCampaignCommentResponse(
    comment: CampaignCommentDocument | CampaignComment,
    author?: UserDocument | User | any,
  ) {
    return {
      id: comment._id?.toString(),
      campaignId: comment.campaignId?.toString(),
      userId:
        (comment.userId as any)?._id?.toString?.() ??
        comment.userId?.toString(),
      author: author
        ? {
            id: author._id?.toString() ?? author.id,
            fullName: author.fullName,
            email: author.email,
          }
        : undefined,
      content: comment.content,
      createdAt: comment.createdAt?.toISOString?.() ?? comment.createdAt,
      updatedAt: comment.updatedAt?.toISOString?.() ?? comment.updatedAt,
    };
  }

  async listComments(id: string) {
    const campaignId = this.toObjectId(id);
    const campaign = await this.campaignModel.exists({ _id: campaignId }).exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    const comments = await this.campaignCommentModel
      .find({ campaignId })
      .sort({ createdAt: 1 })
      .populate('userId', 'fullName email')
      .exec();

    return comments.map((comment: any) =>
      this.toCampaignCommentResponse(comment, comment.userId),
    );
  }

  async createComment(id: string, content: string | undefined, userId?: string) {
    const campaignId = this.toObjectId(id);
    const authorUserId = this.toObjectId(userId);
    const normalizedContent = content?.trim();

    if (!normalizedContent) {
      throw new BadRequestException('Comentário é obrigatório.');
    }

    const campaign = await this.campaignModel.exists({ _id: campaignId }).exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    const comment = await this.campaignCommentModel.create({
      campaignId,
      userId: authorUserId,
      content: normalizedContent,
    });

    await this.campaignModel
      .updateOne({ _id: campaignId }, { $inc: { 'stats.commentsCount': 1 } })
      .exec();

    const author = await this.userModel.findById(authorUserId).lean().exec();
    return this.toCampaignCommentResponse(comment, author);
  }

  async like(id: string, userId?: string) {
    const campaignId = this.toObjectId(id);
    const ownerId = this.toObjectId(userId);
    const campaign = await this.campaignModel.exists({ _id: campaignId }).exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    const existing = await this.campaignReactionModel
      .findOne({ campaignId, userId: ownerId })
      .exec();

    if (existing) {
      return { campaignId: id, liked: true };
    }

    await this.campaignReactionModel.create({
      campaignId,
      userId: ownerId,
      type: 'LIKE',
    });
    await this.campaignModel
      .updateOne({ _id: campaignId }, { $inc: { 'stats.likesCount': 1 } })
      .exec();

    return { campaignId: id, liked: true };
  }

  async unlike(id: string, userId?: string) {
    const campaignId = this.toObjectId(id);
    const ownerId = this.toObjectId(userId);
    const reaction = await this.campaignReactionModel
      .findOneAndDelete({ campaignId, userId: ownerId })
      .exec();

    if (reaction) {
      await this.campaignModel
        .updateOne({ _id: campaignId }, { $inc: { 'stats.likesCount': -1 } })
        .exec();
    }

    return { campaignId: id, liked: false };
  }

  async share(id: string) {
    const campaignId = this.toObjectId(id);
    const campaign = await this.campaignModel
      .findByIdAndUpdate(
        campaignId,
        { $inc: { 'stats.sharesCount': 1 } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada.`);
    }

    return { campaignId: id, sharesCount: campaign.stats?.sharesCount ?? 0 };
  }
}
