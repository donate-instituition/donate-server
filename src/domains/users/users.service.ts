import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
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
  AuditLog,
  AuditLogDocument,
} from '../audit-logs/schemas/audit-log.schema';
import {
  Campaign,
  CampaignDocument,
} from '../campaigns/schemas/campaign.schema';
import { DonationStatus } from '../donations/models';
import {
  Donation,
  DonationDocument,
} from '../donations/schemas/donation.schema';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { CreateUserDto, type UserRoleGrantInput } from './dto/create-user.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole, UserStatus, UserType } from './models';
import { User, UserDocument } from './schemas/user.schema';

export type PublicUser = Omit<
  ReturnType<UserDocument['toObject']>,
  'passwordHash'
>;

type MongoDuplicateKeyError = {
  code?: number;
  codeName?: string;
  keyPattern?: Record<string, number>;
};

type LegacyUserRoleDocument = {
  _id: Types.ObjectId;
  role?: UserRole;
  roles?: Array<UserRole | UserRoleGrantInput>;
};

type UserRoleGrant = {
  name: UserRole;
  grantedAt: Date;
  grantedBy: {
    source: 'SYSTEM' | 'USER';
    label: string;
    userId?: Types.ObjectId;
  };
};

function uniqueRoles(roles: UserRole[]) {
  return Array.from(new Set(roles));
}

function getRoleName(role: UserRole | UserRoleGrantInput): UserRole {
  return typeof role === 'string' ? role : role.name;
}

function systemGrant(role: UserRole): UserRoleGrant {
  return {
    name: role,
    grantedAt: new Date(),
    grantedBy: {
      source: 'SYSTEM',
      label: 'sistema',
    },
  };
}

function normalizeRoleGrants(
  roles?: Array<UserRole | UserRoleGrantInput>,
): UserRoleGrant[] {
  const roleNames = uniqueRoles(
    (roles?.length ? roles : [UserRole.DONOR]).map(getRoleName),
  );

  if (
    (roleNames.includes(UserRole.PLATFORM_ADMIN) ||
      roleNames.includes(UserRole.INSTITUTION_STAFF)) &&
    !roleNames.includes(UserRole.DONOR)
  ) {
    roleNames.push(UserRole.DONOR);
  }

  return roleNames.map((roleName) => {
    const existingGrant = roles?.find((role) => getRoleName(role) === roleName);

    if (existingGrant && typeof existingGrant !== 'string') {
      return {
        name: existingGrant.name,
        grantedAt: existingGrant.grantedAt ?? new Date(),
        grantedBy: existingGrant.grantedBy ?? {
          source: 'SYSTEM',
          label: 'sistema',
        },
      };
    }

    return systemGrant(roleName);
  });
}

function normalizeSettings(
  settings: CreateUserDto['settings'] | undefined,
  roles: UserRoleGrant[],
) {
  if (!settings) {
    return undefined;
  }

  const roleNames = roles.map((role) => role.name);
  const preferredRole =
    settings.preferredRole && roleNames.includes(settings.preferredRole)
      ? settings.preferredRole
      : undefined;

  return {
    ...settings,
    preferredRole,
  };
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  private async dropLegacyNameIndex() {
    try {
      await this.userModel.collection.dropIndex('name_1');
      this.logger.log('Dropped legacy users.name_1 index');
    } catch (error) {
      const mongoError = error as { codeName?: string; code?: number };

      if (mongoError.codeName !== 'IndexNotFound' && mongoError.code !== 27) {
        throw error;
      }
    }
  }

  private isDuplicateKey(error: unknown): error is MongoDuplicateKeyError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as MongoDuplicateKeyError).code === 11000
    );
  }

  async onModuleInit() {
    await this.dropLegacyNameIndex();

    const users = (await this.userModel
      .find()
      .select('_id role roles')
      .lean()
      .exec()) as LegacyUserRoleDocument[];

    await Promise.all(
      users.map((user) => {
        const rawRoles =
          Array.isArray(user.roles) && user.roles.length
            ? user.roles
            : user.role
              ? [user.role]
              : [UserRole.DONOR];

        const roleGrants = normalizeRoleGrants(rawRoles);

        return this.userModel
          .updateOne(
            { _id: user._id },
            {
              $set: { roles: roleGrants },
              $unset: { role: '' },
            },
          )
          .exec();
      }),
    );
  }

  async create(createUserDto: CreateUserDto) {
    const normalizedEmail = createUserDto.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new ConflictException('Email is required');
    }

    const existingUser = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (createUserDto.cpf) {
      const existingCpf = await this.userModel
        .findOne({ cpf: createUserDto.cpf })
        .exec();

      if (existingCpf) {
        throw new ConflictException('CPF already registered');
      }
    }

    if (!createUserDto.fullName?.trim()) {
      throw new BadRequestException('Name is required');
    }

    const roles = normalizeRoleGrants(createUserDto.roles);
    const settings = normalizeSettings(createUserDto.settings, roles);
    const payload = {
      type: createUserDto.type ?? UserType.PERSON,
      roles,
      fullName: createUserDto.fullName,
      email: normalizedEmail,
      phone: createUserDto.phone,
      cpf: createUserDto.cpf,
      birthDate: createUserDto.birthDate,
      passwordHash: createUserDto.passwordHash,
      googleId: createUserDto.googleId,
      profilePhotoUrl: createUserDto.profilePhotoUrl,
      passwordChangeRequired: createUserDto.passwordChangeRequired ?? false,
      activationTokenVersion: createUserDto.activationTokenVersion,
      status: createUserDto.status ?? UserStatus.ACTIVE,
      isVerified: createUserDto.isVerified ?? true,
      termsAccepted: createUserDto.termsAccepted ?? false,
      acceptedTermsVersion: createUserDto.acceptedTermsVersion,
      termsAcceptedAt: createUserDto.termsAcceptedAt,
      ...(settings ? { settings } : {}),
    };

    try {
      return await this.userModel.create(payload);
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        if (error.keyPattern?.name) {
          await this.dropLegacyNameIndex();
          return this.userModel.create(payload);
        }

        if (error.keyPattern?.email) {
          throw new ConflictException('Email already registered');
        }

        if (error.keyPattern?.cpf) {
          throw new ConflictException('CPF already registered');
        }
      }

      throw error;
    }
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  findByGoogleId(googleId: string) {
    return this.userModel.findOne({ googleId }).exec();
  }

  toPublicUser(user: UserDocument): PublicUser {
    const { passwordHash, ...publicUser } = user.toObject();
    void passwordHash;

    return publicUser;
  }

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

    return status ? (statusMap[status] ?? 'pending') : 'pending';
  }

  private toPostResponse(post: PostDocument | any) {
    return {
      id: post._id?.toString() ?? post.id,
      authorType: post.authorType,
      authorId: post.authorId?.toString(),
      campaignId: post.campaignId?.toString(),
      institutionId: post.institutionId?.toString(),
      content: post.content,
      media: post.media ?? [],
      visibility: post.visibility,
      stats: post.stats ?? { likesCount: 0, commentsCount: 0, sharesCount: 0 },
      createdAt: post.createdAt?.toISOString?.() ?? post.createdAt,
      updatedAt: post.updatedAt?.toISOString?.() ?? post.updatedAt,
    };
  }

  private toAuditLogResponse(auditLog: AuditLogDocument | any) {
    return {
      id: auditLog._id?.toString() ?? auditLog.id,
      actorUserId: auditLog.actorUserId?.toString(),
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId?.toString(),
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt?.toISOString?.() ?? auditLog.createdAt,
    };
  }

  async findAll(query: PaginationQuery = {}) {
    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const filter: Record<string, unknown> = {};

    if (pagination.search) {
      filter.$or = [
        { fullName: { $regex: pagination.search, $options: 'i' } },
        { email: { $regex: pagination.search, $options: 'i' } },
        { cpf: { $regex: pagination.search, $options: 'i' } },
      ];
    }

    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: pagination.sort === 'name' ? 1 : -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .exec();
    const items = users.map((user) => this.toPublicUser(user));

    if (!shouldReturnPaginated) {
      return items;
    }

    const [total, donorsCount, institutionStaffCount, platformAdminsCount] =
      await Promise.all([
        this.userModel.countDocuments(filter).exec(),
        this.userModel.countDocuments({ roles: { $elemMatch: { name: UserRole.DONOR } } }).exec(),
        this.userModel.countDocuments({ roles: { $elemMatch: { name: UserRole.INSTITUTION_STAFF } } }).exec(),
        this.userModel.countDocuments({ roles: { $elemMatch: { name: UserRole.PLATFORM_ADMIN } } }).exec(),
      ]);

    return {
      ...paginatedResponse(items, total, pagination),
      summary: {
        donorsCount,
        institutionStaffCount,
        platformAdminsCount,
      },
    };
  }

  findOne(id: string) {
    return this.userModel.findById(id).exec();
  }

  async findAdminDetail(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    const userId = new Types.ObjectId(id);
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      return null;
    }

    const [donations, posts, auditLogs] = await Promise.all([
      this.donationModel
        .find({ donorUserId: userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec(),
      this.postModel
        .find({ authorId: userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec(),
      this.auditLogModel
        .find({
          $or: [{ actorUserId: userId }, { targetId: userId }],
        })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean()
        .exec(),
    ]);
    const campaignIds = donations
      .map((donation) => donation.campaignId?.toString())
      .filter((value): value is string => Boolean(value));
    const institutionIds = donations
      .map((donation) => donation.institutionId?.toString())
      .filter((value): value is string => Boolean(value));
    const [campaigns, institutions] = await Promise.all([
      this.campaignModel.find({ _id: { $in: campaignIds } }).lean().exec(),
      this.institutionModel.find({ _id: { $in: institutionIds } }).lean().exec(),
    ]);
    const campaignMap = new Map(
      campaigns.map((campaign) => [campaign._id.toString(), campaign]),
    );
    const institutionMap = new Map(
      institutions.map((institution) => [institution._id.toString(), institution]),
    );
    const donationItems = donations.map((donation) => {
      const amountCents = donation.moneyDonation?.amount
        ? Math.round(donation.moneyDonation.amount * 100)
        : 0;
      const campaign = campaignMap.get(donation.campaignId?.toString() ?? '');
      const institution = institutionMap.get(
        donation.institutionId?.toString() ?? '',
      );

      return {
        id: donation._id?.toString(),
        amountCents,
        amountFormatted: this.formatCurrency(amountCents),
        campaignId: donation.campaignId?.toString(),
        campaignTitle: campaign?.title ?? 'Campanha',
        institutionName:
          institution?.displayName || institution?.legalName || 'Instituição',
        status: this.toAppDonationStatus(donation.status),
        createdAt:
          donation.createdAt?.toISOString?.() ?? donation.createdAt,
      };
    });

    return {
      user: this.toPublicUser(user),
      donations: donationItems,
      posts: posts.map((post) => this.toPostResponse(post)),
      auditLogs: auditLogs.map((auditLog) => this.toAuditLogResponse(auditLog)),
      stats: {
        auditLogsCount: await this.auditLogModel
          .countDocuments({ $or: [{ actorUserId: userId }, { targetId: userId }] })
          .exec(),
        donationsCount: await this.donationModel
          .countDocuments({ donorUserId: userId })
          .exec(),
        postsCount: await this.postModel
          .countDocuments({ authorId: userId })
          .exec(),
        totalDonatedCents: donationItems.reduce(
          (total, donation) => total + donation.amountCents,
          0,
        ),
      },
    };
  }

  removeById(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  upsertDevUser(createUserDto: CreateUserDto) {
    const normalizedEmail = createUserDto.email.trim().toLowerCase();
    const roles = normalizeRoleGrants(createUserDto.roles);
    const settings = normalizeSettings(createUserDto.settings, roles);

    return this.userModel
      .findOneAndUpdate(
        { email: normalizedEmail },
        {
          $set: {
            type: createUserDto.type ?? UserType.PERSON,
            roles,
            fullName: createUserDto.fullName,
            email: normalizedEmail,
            phone: createUserDto.phone,
            cpf: createUserDto.cpf,
            birthDate: createUserDto.birthDate,
            passwordHash: createUserDto.passwordHash,
            passwordChangeRequired:
              createUserDto.passwordChangeRequired ?? false,
            activationTokenVersion: createUserDto.activationTokenVersion,
            status: createUserDto.status ?? UserStatus.ACTIVE,
            isVerified: createUserDto.isVerified ?? true,
            termsAccepted: createUserDto.termsAccepted ?? false,
            acceptedTermsVersion: createUserDto.acceptedTermsVersion,
            termsAcceptedAt: createUserDto.termsAcceptedAt,
            ...(settings ? { settings } : {}),
          },
          $unset: { role: '' },
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async updatePreferredRole(id: string, preferredRole: UserRole) {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      return null;
    }

    const roles = normalizeRoleGrants(user.roles);
    const roleNames = roles.map((role) => role.name);

    if (!roleNames.includes(preferredRole)) {
      throw new BadRequestException(
        'Preferred role is not available for this user',
      );
    }

    user.roles = roles;
    user.settings = {
      ...user.settings,
      preferredRole,
    };

    await user.save();
    return user;
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { returnDocument: 'after' })
      .exec();
  }

  acceptTerms(id: string, version: string) {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            acceptedTermsVersion: version,
            termsAccepted: true,
            termsAcceptedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async registerPushToken(id: string, registerPushTokenDto: RegisterPushTokenDto) {
    const token = registerPushTokenDto.token?.trim();

    if (!token) {
      throw new BadRequestException('Push token is required');
    }

    const user = await this.userModel.findById(id).exec();

    if (!user) {
      return null;
    }

    const now = new Date();
    await this.userModel
      .updateMany(
        { _id: { $ne: id }, 'pushTokens.token': token },
        { $set: { 'pushTokens.$.disabledAt': now } },
      )
      .exec();

    const pushTokens = user.pushTokens ?? [];
    const existingToken = pushTokens.find((item) => item.token === token);

    if (existingToken) {
      existingToken.appVersion = registerPushTokenDto.appVersion;
      existingToken.deviceId = registerPushTokenDto.deviceId;
      existingToken.platform = registerPushTokenDto.platform ?? 'unknown';
      existingToken.lastSeenAt = now;
      existingToken.disabledAt = undefined;
    } else {
      pushTokens.push({
        appVersion: registerPushTokenDto.appVersion,
        deviceId: registerPushTokenDto.deviceId,
        platform: registerPushTokenDto.platform ?? 'unknown',
        token,
        lastSeenAt: now,
      });
    }

    user.pushTokens = pushTokens.slice(-12);
    await user.save();

    return { registered: true };
  }

  async unregisterPushToken(
    id: string,
    unregisterPushTokenDto: UnregisterPushTokenDto,
  ) {
    const token = unregisterPushTokenDto.token?.trim();

    if (!token) {
      throw new BadRequestException('Push token is required');
    }

    await this.userModel
      .updateOne(
        { _id: id, 'pushTokens.token': token },
        { $set: { 'pushTokens.$.disabledAt': new Date() } },
      )
      .exec();

    return { unregistered: true };
  }

  markTermsPendingForVersionChange() {
    return this.userModel
      .updateMany(
        {},
        {
          $set: { termsAccepted: false },
        },
      )
      .exec();
  }

  remove(id: string) {
    return `This action removes a #${id} user`;
  }
}
