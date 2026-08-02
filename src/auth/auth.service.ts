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
import { sign, verify } from 'jsonwebtoken';
import { Model, Types } from 'mongoose';

import { env } from '../config/env';
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
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';
import {
  RefreshTokenSession,
  RefreshTokenSessionDocument,
} from './schemas/refresh-token-session.schema';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    @InjectModel(RefreshTokenSession.name)
    private readonly refreshTokenSessionModel: Model<RefreshTokenSessionDocument>,
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
  }) {
    const roles = this.toApiRoles(user);

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      roles,
      type: user.type,
      status: user.status,
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

  private async assertCanIssueSession(user: { _id: Types.ObjectId; roles?: Array<UserRole | { name: UserRole }> }) {
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
      status: UserStatus.ACTIVE,
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

    const accessToken = this.createAccessToken(createdUser);
    const refreshToken = this.createRefreshToken(createdUser._id.toString());
    await this.storeRefreshToken(createdUser._id.toString(), refreshToken);

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: this.toSessionUser(createdUser),
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

  async logout(refreshToken?: string, userId?: string) {
    await this.revokeRefreshToken(refreshToken, userId);
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

  forgotPassword(body: { email: string }) {
    return {
      message:
        'Se existir uma conta com este e-mail, enviaremos instruções para redefinição.',
    };
  }
}
