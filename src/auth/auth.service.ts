import {
  ConflictException,
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcryptjs';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { Model, Types } from 'mongoose';

import { env } from '../config/env';
import { AppSettingKey } from '../domains/app-settings/app-settings.defaults';
import { AppSettingsService } from '../domains/app-settings/app-settings.service';
import {
  InstitutionStaffMembershipRole,
  InstitutionStaffMembershipStatus,
} from '../domains/institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../domains/institution-staff-memberships/schemas/institution-staff-membership.schema';
import { InstitutionDonationType, InstitutionStatus } from '../domains/institutions/models';
import {
  Institution,
  InstitutionDocument,
} from '../domains/institutions/schemas/institution.schema';
import { UserRole, UserStatus, UserType } from '../domains/users/models';
import { UsersService } from '../domains/users/users.service';
import { AuditLogsService } from '../domains/audit-logs/audit-logs.service';
import { EmailJobsService } from '../notifications/email/email-jobs.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';
import {
  RefreshTokenSession,
  RefreshTokenSessionDocument,
} from './schemas/refresh-token-session.schema';
import {
  PasswordResetRequest,
  PasswordResetRequestDocument,
  PasswordResetRequestStatus,
} from './schemas/password-reset-request.schema';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import {
  createAccountActivationUrl,
  verifyAccountActivationToken,
} from './account-activation';
import { assertPasswordPolicy } from './password-policy';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emailJobsService: EmailJobsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly appSettingsService: AppSettingsService,
    @InjectModel(RefreshTokenSession.name)
    private readonly refreshTokenSessionModel: Model<RefreshTokenSessionDocument>,
    @InjectModel(PasswordResetRequest.name)
    private readonly passwordResetRequestModel: Model<PasswordResetRequestDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
  ) { }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    await this.seedDevUsers();
  }

  private async seedDevUsers() {
    const passwordHash = await hash('12345678', 10);
    const devBirthDate = new Date('1998-02-09T00:00:00.000Z');

    const [donorUser, institutionUser, adminUser] = await Promise.all([
      this.usersService.upsertDevUser({
        fullName: 'Doador Dev',
        email: 'dev.doador@elodoar.local',
        cpf: '11111111111',
        birthDate: devBirthDate,
        phone: '61999990001',
        passwordHash,
        roles: [UserRole.DONOR],
        type: UserType.PERSON,
        status: UserStatus.ACTIVE,
        isVerified: true,
      }),
      this.usersService.upsertDevUser({
        fullName: 'Instituicao Dev',
        email: 'dev.instituicao@elodoar.local',
        cpf: '22222222222',
        birthDate: devBirthDate,
        phone: '61999990002',
        passwordHash,
        roles: [UserRole.INSTITUTION_STAFF, UserRole.DONOR],
        type: UserType.PERSON,
        status: UserStatus.ACTIVE,
        isVerified: true,
      }),
      this.usersService.upsertDevUser({
        fullName: 'Admin Dev',
        email: 'dev.admin@elodoar.local',
        cpf: '33333333333',
        birthDate: devBirthDate,
        phone: '61999990003',
        passwordHash,
        roles: [UserRole.PLATFORM_ADMIN, UserRole.DONOR],
        type: UserType.PERSON,
        status: UserStatus.ACTIVE,
        isVerified: true,
      }),
    ]);

    void donorUser;
    void adminUser;

    const institution = await this.institutionModel
      .findOneAndUpdate(
        { cnpj: '99999999000191' },
        {
          $set: {
            legalName: 'Instituicao Dev EloDoar',
            displayName: 'Instituicao Dev EloDoar',
            cnpj: '99999999000191',
            email: 'dev.instituicao@elodoar.local',
            phone: '61999990002',
            description: 'Instituicao criada automaticamente para testes locais.',
            status: InstitutionStatus.ACTIVE,
            verification: {
              isVerified: true,
              verifiedAt: new Date(),
              verifiedByUserId: adminUser._id,
            },
            acceptedDonationTypes: [InstitutionDonationType.MONEY],
            taxReceiptEnabled: true,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    await this.institutionStaffMembershipModel
      .findOneAndUpdate(
        {
          institutionId: institution._id,
          userId: institutionUser._id,
        },
        {
          $set: {
            institutionId: institution._id,
            userId: institutionUser._id,
            role: InstitutionStaffMembershipRole.OWNER,
            status: InstitutionStaffMembershipStatus.ACTIVE,
            invitedByUserId: adminUser._id,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.logger.log('Seeded dev login users: dev.doador, dev.instituicao, dev.admin');
  }

  private toSessionUser(user: {
    _id?: { toString(): string };
    fullName?: string;
    name?: string;
    email: string;
    roles?: Array<string | { name: string; grantedAt?: Date; grantedBy?: unknown }>;
    settings?: { preferredRole?: string };
    passwordChangeRequired?: boolean;
    termsAccepted?: boolean;
    acceptedTermsVersion?: string;
    termsAcceptedAt?: Date;
  }) {
    const roles = this.toSessionRoleGrants(user);
    const preferredRole = user.settings?.preferredRole
      ? this.toSessionRole(user.settings.preferredRole)
      : undefined;

    return {
      id: user._id?.toString() ?? 'pending',
      name: user.fullName ?? user.name ?? user.email,
      email: user.email,
      roles,
      preferredRole: roles.some((role) => role.name === preferredRole) ? preferredRole : undefined,
      passwordChangeRequired: Boolean(user.passwordChangeRequired),
      termsAccepted: Boolean(user.termsAccepted),
      acceptedTermsVersion: user.acceptedTermsVersion,
      termsAcceptedAt: user.termsAcceptedAt?.toISOString?.(),
    };
  }

  private toSessionRole(role: string) {
    const roleMap: Record<string, string> = {
      PLATFORM_ADMIN: 'platform-admin',
      DONOR: 'donor',
      INSTITUTION_STAFF: 'institution-staff',
      'platform-admin': 'platform-admin',
      donor: 'donor',
      'institution-staff': 'institution-staff',
    };

    return roleMap[role] ?? 'donor';
  }

  private getRoleName(role: string | { name: string }) {
    return typeof role === 'string' ? role : role.name;
  }

  private toSessionRoleGrants(user: {
    roles?: Array<string | { name: string; grantedAt?: Date; grantedBy?: unknown }>;
  }) {
    const rawRoles = user.roles?.length ? user.roles : [UserRole.DONOR];
    const mappedRoles = rawRoles.map((role) => ({
      name: this.toSessionRole(this.getRoleName(role)),
      grantedAt: typeof role === 'string' ? new Date().toISOString() : role.grantedAt?.toISOString?.() ?? new Date().toISOString(),
      grantedBy: typeof role === 'string'
        ? { source: 'SYSTEM', label: 'sistema' }
        : role.grantedBy ?? { source: 'SYSTEM', label: 'sistema' },
    }));
    const roleNames = mappedRoles.map((role) => role.name);

    if (rawRoles.map((role) => this.getRoleName(role)).includes(UserRole.PLATFORM_ADMIN) && !roleNames.includes('donor')) {
      mappedRoles.push({
        name: 'donor',
        grantedAt: new Date().toISOString(),
        grantedBy: { source: 'SYSTEM', label: 'sistema' },
      });
    }

    if (rawRoles.map((role) => this.getRoleName(role)).includes(UserRole.INSTITUTION_STAFF) && !roleNames.includes('donor')) {
      mappedRoles.push({
        name: 'donor',
        grantedAt: new Date().toISOString(),
        grantedBy: { source: 'SYSTEM', label: 'sistema' },
      });
    }

    return mappedRoles.filter((role, index, all) => all.findIndex((item) => item.name === role.name) === index);
  }

  private createAccessToken(user: {
    _id: any;
    email: string;
    roles?: Array<string | { name: string }>;
    type: string;
    status: string;
    passwordChangeRequired?: boolean;
  }) {
    const roles = this.toApiRoles(user);

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      roles,
      type: user.type,
      status: user.status,
      passwordChangeRequired: Boolean(user.passwordChangeRequired),
    };

    return sign(payload, env.jwtSecret, {
      expiresIn: '15m' as never,
    });
  }

  private createRefreshToken(userId: string) {
    return sign({ sub: userId, type: 'refresh' }, env.jwtSecret, {
      expiresIn: '7d' as never,
    });
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await this.refreshTokenSessionModel.create({
      userId: new Types.ObjectId(userId),
      refreshTokenHash: hashedRefreshToken,
      expiresAt,
    });
  }

  private async revokeRefreshToken(refreshToken?: string, userId?: string) {
    if (!refreshToken && !userId) {
      return false;
    }

    if (refreshToken) {
      const tokenMatches = await this.refreshTokenSessionModel
        .find({ revokedAt: { $exists: false } })
        .lean()
        .exec();

      for (const session of tokenMatches as Array<RefreshTokenSession & { _id: Types.ObjectId }>) {
        const matches = await compare(refreshToken, session.refreshTokenHash);
        if (matches) {
          await this.refreshTokenSessionModel.findByIdAndUpdate(session._id, { revokedAt: new Date() }).exec();
          return true;
        }
      }
      return false;
    }

    if (userId) {
      await this.refreshTokenSessionModel
        .updateMany({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }, { revokedAt: new Date() })
        .exec();
      return true;
    }

    return false;
  }

  private toApiRoles(user: { roles?: Array<string | { name: string }> }) {
    const roles = user.roles?.length ? user.roles.map((role) => this.getRoleName(role)) : [UserRole.DONOR];

    if (roles.includes(UserRole.PLATFORM_ADMIN) && !roles.includes(UserRole.DONOR)) {
      roles.push(UserRole.DONOR);
    }

    if (roles.includes(UserRole.INSTITUTION_STAFF) && !roles.includes(UserRole.DONOR)) {
      roles.push(UserRole.DONOR);
    }

    return Array.from(new Set(roles));
  }

  private async assertCanIssueSession(user: {
    _id: Types.ObjectId;
    roles?: Array<UserRole | { name: UserRole }>;
    status?: UserStatus;
  }) {
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'ACCOUNT_PENDING_VERIFICATION',
        message: 'Account pending verification',
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account suspended',
      });
    }

    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'ACCOUNT_DELETED',
        message: 'Account deleted',
      });
    }

    const roles = this.toApiRoles(user);

    if (!roles.includes(UserRole.INSTITUTION_STAFF)) {
      return;
    }

    const memberships = await this.institutionStaffMembershipModel
      .find({
        userId: user._id,
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .lean()
      .exec();

    if (memberships.length === 0) {
      throw new UnauthorizedException('Institution access is not active');
    }

    const institutionIds = memberships.map((membership) => membership.institutionId);
    const approvedInstitution = await this.institutionModel
      .findOne({
        _id: { $in: institutionIds },
        status: InstitutionStatus.ACTIVE,
        'verification.isVerified': true,
      })
      .lean()
      .exec();

    if (!approvedInstitution) {
      throw new UnauthorizedException('Institution registration is pending approval');
    }
  }

  private async audit(input: {
    action: string;
    actorUserId?: string;
    targetId?: string;
    targetType: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.auditLogsService.create({
        action: input.action,
        actorUserId:
          input.actorUserId && Types.ObjectId.isValid(input.actorUserId)
            ? new Types.ObjectId(input.actorUserId)
            : undefined,
        targetId:
          input.targetId && Types.ObjectId.isValid(input.targetId)
            ? new Types.ObjectId(input.targetId)
            : undefined,
        targetType: input.targetType,
        metadata: input.metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log ${input.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await compare(loginDto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.assertCanIssueSession(user);

    const accessToken = this.createAccessToken(user);
    const refreshToken = this.createRefreshToken(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), refreshToken);
    await this.audit({
      action: 'auth.login',
      actorUserId: user._id.toString(),
      targetId: user._id.toString(),
      targetType: 'user',
      metadata: { email: user.email },
    });

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: this.toSessionUser(user),
    };
  }

  async register(registerDto: RegisterDto) {
    if (!registerDto.name?.trim()) {
      throw new BadRequestException('Name is required');
    }

    if (!registerDto.email?.trim()) {
      throw new BadRequestException('Email is required');
    }

    if (!registerDto.password) {
      throw new BadRequestException('Password is required');
    }
    assertPasswordPolicy(registerDto.password);

    if (!registerDto.cpf?.trim()) {
      throw new BadRequestException('CPF is required');
    }

    if (!registerDto.birthDate?.trim()) {
      throw new BadRequestException('Birth date is required');
    }

    if (!registerDto.phone?.trim()) {
      throw new BadRequestException('Phone is required');
    }

    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const accountType = registerDto.accountType ?? 'DONOR';
    let existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      const orphanInstitutionStaff =
        accountType === 'INSTITUTION' &&
        this.toApiRoles(existingUser).includes(UserRole.INSTITUTION_STAFF) &&
        !(await this.institutionStaffMembershipModel.exists({ userId: existingUser._id }).exec());

      if (!orphanInstitutionStaff) {
        throw new ConflictException('Email already registered');
      }

      await this.usersService.removeById(existingUser._id.toString());
      existingUser = null;
    }

    const normalizedCnpj = registerDto.institutionCnpj?.replace(/\D/g, '') ?? '';

    if (accountType === 'INSTITUTION') {
      if (!normalizedCnpj) {
        throw new BadRequestException('Institution CNPJ is required');
      }

      const existingInstitution = await this.institutionModel.findOne({ cnpj: normalizedCnpj }).exec();

      if (existingInstitution) {
        throw new ConflictException('Institution CNPJ already registered');
      }
    }

    const createdUser = await this.usersService.create({
      fullName: registerDto.name,
      email: normalizedEmail,
      cpf: registerDto.cpf,
      birthDate: registerDto.birthDate ? new Date(registerDto.birthDate) : undefined,
      phone: registerDto.phone,
      passwordHash: await hash(registerDto.password, 10),
      roles:
        accountType === 'INSTITUTION'
          ? [UserRole.INSTITUTION_STAFF, UserRole.DONOR]
          : [UserRole.DONOR],
      type: UserType.PERSON,
      status:
        accountType === 'INSTITUTION'
          ? UserStatus.ACTIVE
          : UserStatus.PENDING_VERIFICATION,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    });

    try {
      if (accountType === 'INSTITUTION') {
        const institution = await this.institutionModel.create({
          legalName: registerDto.institutionLegalName?.trim() || registerDto.institutionDisplayName?.trim() || registerDto.name,
          displayName: registerDto.institutionDisplayName?.trim() || registerDto.institutionLegalName?.trim() || registerDto.name,
          cnpj: normalizedCnpj,
          email: (registerDto.institutionEmail || normalizedEmail).trim().toLowerCase(),
          phone: registerDto.institutionPhone?.replace(/\D/g, '') || registerDto.phone,
          description: registerDto.institutionDescription,
          website: registerDto.institutionWebsite,
          status: InstitutionStatus.PENDING_APPROVAL,
          verification: { isVerified: false },
          acceptedDonationTypes: [InstitutionDonationType.MONEY],
          taxReceiptEnabled: true,
        });

        try {
          await this.institutionStaffMembershipModel.create({
            institutionId: institution._id,
            userId: createdUser._id,
            role: InstitutionStaffMembershipRole.OWNER,
            status: InstitutionStaffMembershipStatus.ACTIVE,
          });
        } catch (error) {
          await this.institutionModel.findByIdAndDelete(institution._id).exec();
          throw error;
        }

        await this.audit({
          action: 'auth.account_created',
          targetId: createdUser._id.toString(),
          targetType: 'user',
          metadata: {
            accountType,
            email: normalizedEmail,
            institutionId: institution._id.toString(),
          },
        });

        return {
          status: 'pending-approval',
          message: 'Institution registration submitted for platform review',
          institution: {
            id: institution._id.toString(),
            name: institution.displayName,
            status: institution.status,
          },
        };
      }
    } catch (error) {
      await this.usersService.removeById(createdUser._id.toString());
      throw error;
    }

    await this.queueAccountCreatedEmail({
      accountStatus: 'pending-verification',
      email: normalizedEmail,
      name: createdUser.fullName,
      userId: createdUser._id.toString(),
    });
    await this.audit({
      action: 'auth.account_created',
      targetId: createdUser._id.toString(),
      targetType: 'user',
      metadata: { accountType, email: normalizedEmail },
    });

    return {
      status: 'pending-verification',
      message: 'Account created. Check your email to activate your account.',
      email: normalizedEmail,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    let payload: { sub: string; type?: string };

    try {
      payload = verify(refreshToken, env.jwtSecret) as { sub: string; type?: string };
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const sessions = await this.refreshTokenSessionModel.find().lean().exec();
    let matchingSession: RefreshTokenSessionDocument | null = null;

    for (const session of sessions) {
      const matches = await compare(refreshToken, session.refreshTokenHash);
      if (matches && (!session.revokedAt || session.revokedAt > new Date())) {
        matchingSession = session as RefreshTokenSessionDocument;
        break;
      }
    }

    if (!matchingSession) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.usersService.findOne(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    await this.assertCanIssueSession(user);

    const newAccessToken = this.createAccessToken(user);
    return {
      token: newAccessToken,
      accessToken: newAccessToken,
      user: this.toSessionUser(user),
    };
  }

  async activateAccount(body: { token: string }) {
    if (!body.token?.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        message: 'Account activation token is invalid',
      });
    }

    let payload: { sub: string; version: string };

    try {
      payload = verifyAccountActivationToken(body.token.trim());
    } catch {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        message: 'Account activation token is invalid',
      });
    }

    const user = await this.usersService.findOne(payload.sub);

    if (!user) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        message: 'Account activation token is invalid',
      });
    }

    if (user.activationTokenVersion !== payload.version) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        message: 'Account activation token is invalid',
      });
    }

    if (user.status === UserStatus.PENDING_VERIFICATION || !user.isVerified) {
      await this.usersService.update(user._id.toString(), {
        activationTokenVersion: null,
        isVerified: true,
        status: UserStatus.ACTIVE,
      });
    }
    await this.audit({
      action: 'auth.account_activated',
      actorUserId: user._id.toString(),
      targetId: user._id.toString(),
      targetType: 'user',
      metadata: { email: user.email },
    });

    return {
      email: user.email,
      message: 'Conta ativada com sucesso.',
      status: 'active',
    };
  }

  async resendActivationEmail(body: { email: string }) {
    const email = body.email?.trim().toLowerCase();
    const response = {
      message:
        'Se existir uma conta pendente com este e-mail, enviaremos um novo link de ativação.',
    };

    if (!email) {
      return response;
    }

    const user = await this.usersService.findByEmail(email);

    if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
      return response;
    }

    await this.queueAccountCreatedEmail({
      accountStatus: 'pending-verification',
      email: user.email,
      name: user.fullName ?? user.email,
      userId: user._id.toString(),
    });
    await this.audit({
      action: 'auth.activation_resent',
      targetId: user._id.toString(),
      targetType: 'user',
      metadata: { email: user.email },
    });

    return response;
  }

  async logout(refreshToken?: string, userId?: string) {
    await this.revokeRefreshToken(refreshToken, userId);
    await this.audit({
      action: 'auth.logout',
      actorUserId: userId,
      targetId: userId,
      targetType: 'user',
    });
    return { message: 'Logged out successfully' };
  }

  async updateMySettings(user: AuthenticatedUser | undefined, body: UpdateMySettingsDto) {
    if (!user) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    if (!body.preferredRole) {
      throw new BadRequestException('Preferred role is required');
    }

    const updatedUser = await this.usersService.updatePreferredRole(user.sub, body.preferredRole);

    if (!updatedUser) {
      throw new UnauthorizedException('Authentication token is invalid');
    }

    return this.toSessionUser(updatedUser);
  }

  async forgotPassword(body: { email: string }) {
    const email = body.email?.trim().toLowerCase();
    const response = {
      message:
        'Se existir uma conta com este e-mail, enviaremos um código para redefinição.',
    };

    if (!email) {
      return response;
    }

    const user = await this.usersService.findByEmail(email);

    if (!user || user.status === UserStatus.DELETED) {
      return response;
    }

    const code = this.generateResetCode();

    await this.passwordResetRequestModel
      .updateMany(
        { email, status: PasswordResetRequestStatus.Pending },
        { status: PasswordResetRequestStatus.Used, usedAt: new Date() },
      )
      .exec();

    const resetRequest = await this.passwordResetRequestModel.create({
      codeHash: await hash(code, 10),
      email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15),
    });
    await this.audit({
      action: 'auth.password_reset_requested',
      targetId: user._id.toString(),
      targetType: 'user',
      metadata: { email },
    });

    await this.queuePasswordResetCodeEmail({
      code,
      email,
      name: user.fullName ?? user.email,
      resetRequestId: resetRequest._id.toString(),
      userId: user._id.toString(),
    });

    return {
      message:
        'Se existir uma conta com este e-mail, enviaremos um código para redefinição.',
    };
  }

  async confirmForgotPassword(body: { email: string; code: string }) {
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();

    if (!email || !/^\d{6}$/.test(code ?? '')) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'Invalid reset code',
      });
    }

    const resetRequest = await this.passwordResetRequestModel
      .findOne({
        email,
        expiresAt: { $gt: new Date() },
        status: PasswordResetRequestStatus.Pending,
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!resetRequest || resetRequest.attempts >= 5) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'Invalid reset code',
      });
    }

    const codeMatches = await compare(code, resetRequest.codeHash);

    if (!codeMatches) {
      resetRequest.attempts += 1;
      await resetRequest.save();
      throw new BadRequestException({
        statusCode: 400,
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'Invalid reset code',
      });
    }

    const user = await this.usersService.findByEmail(email);

    if (!user || user.status === UserStatus.DELETED) {
      resetRequest.status = PasswordResetRequestStatus.Used;
      resetRequest.usedAt = new Date();
      await resetRequest.save();
      return { message: 'Se o código estiver correto, enviaremos uma senha temporária por e-mail.' };
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const updatedUser = await this.usersService.update(user._id.toString(), {
      passwordChangeRequired: true,
      passwordHash: await hash(temporaryPassword, 10),
    });

    resetRequest.status = PasswordResetRequestStatus.Used;
    resetRequest.usedAt = new Date();
    await resetRequest.save();

    await this.revokeRefreshToken(undefined, user._id.toString());
    await this.queueTemporaryPasswordEmail({
      email,
      name: updatedUser?.fullName ?? user.fullName ?? user.email,
      resetRequestId: resetRequest._id.toString(),
      temporaryPassword,
      userId: user._id.toString(),
    });
    await this.audit({
      action: 'auth.password_reset_confirmed',
      targetId: user._id.toString(),
      targetType: 'user',
      metadata: { email },
    });

    return { message: 'Enviamos uma senha temporária para seu e-mail.' };
  }

  async changePassword(user: AuthenticatedUser | undefined, body: { currentPassword: string; newPassword: string }) {
    if (!user) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }
    assertPasswordPolicy(body.newPassword);

    if (body.currentPassword === body.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const existingUser = await this.usersService.findOne(user.sub);

    if (!existingUser) {
      throw new UnauthorizedException('Authentication token is invalid');
    }

    const passwordMatches = await compare(body.currentPassword, existingUser.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is invalid');
    }

    const updatedUser = await this.usersService.update(existingUser._id.toString(), {
      passwordChangeRequired: false,
      passwordHash: await hash(body.newPassword, 10),
    });

    if (!updatedUser) {
      throw new UnauthorizedException('Authentication token is invalid');
    }

    await this.revokeRefreshToken(undefined, existingUser._id.toString());
    const accessToken = this.createAccessToken(updatedUser);
    const refreshToken = this.createRefreshToken(updatedUser._id.toString());
    await this.storeRefreshToken(updatedUser._id.toString(), refreshToken);
    await this.audit({
      action: 'auth.password_changed',
      actorUserId: updatedUser._id.toString(),
      targetId: updatedUser._id.toString(),
      targetType: 'user',
    });

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: this.toSessionUser(updatedUser),
    };
  }

  private generateResetCode() {
    return String(randomInt(100000, 1000000));
  }

  private generateTemporaryPassword() {
    return `Elo-${randomBytes(5).toString('hex')}A7`;
  }

  private async queueAccountCreatedEmail(input: {
    accountStatus: 'pending-approval' | 'pending-verification';
    email: string;
    name: string;
    userId: string;
  }) {
    try {
      const activationTokenVersion =
        input.accountStatus === 'pending-verification' ? randomUUID() : undefined;
      if (activationTokenVersion) {
        await this.usersService.update(input.userId, { activationTokenVersion });
      }

      await this.emailJobsService.sendAccountCreatedEmail({
        accountStatus: input.accountStatus,
        activationUrl:
          activationTokenVersion
            ? createAccountActivationUrl(
                input.userId,
                activationTokenVersion,
                await this.appSettingsService.getString(
                  AppSettingKey.EMAIL_ACCOUNT_ACTIVATION_URL,
                  env.emailAccountActivationUrl,
                ),
              )
            : undefined,
        name: input.name,
        to: input.email,
        userId: input.userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue account created email for user ${input.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async queuePasswordResetCodeEmail(input: {
    code: string;
    email: string;
    name: string;
    resetRequestId: string;
    userId: string;
  }) {
    try {
      await this.emailJobsService.sendPasswordResetCodeEmail({
        code: input.code,
        jobId: input.resetRequestId,
        name: input.name,
        to: input.email,
        userId: input.userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue password reset code email for user ${input.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async queueTemporaryPasswordEmail(input: {
    email: string;
    name: string;
    resetRequestId: string;
    temporaryPassword: string;
    userId: string;
  }) {
    try {
      await this.emailJobsService.sendTemporaryPasswordEmail({
        name: input.name,
        jobId: input.resetRequestId,
        temporaryPassword: input.temporaryPassword,
        to: input.email,
        userId: input.userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue temporary password email for user ${input.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
