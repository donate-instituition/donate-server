import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { hash } from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';

import { createAccountActivationUrl } from '../../auth/account-activation';
import { assertPasswordPolicy } from '../../auth/password-policy';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailJobsService } from '../../notifications/email/email-jobs.service';
import { UserRole, UserStatus, UserType } from '../users/models';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import { CreateInstitutionStaffMembershipDto } from './dto/create-institution-staff-membership.dto';
import { CreateInstitutionStaffUserDto } from './dto/create-institution-staff-user.dto';
import { UpdateInstitutionStaffMembershipDto } from './dto/update-institution-staff-membership.dto';
import {
  InstitutionStaffMembershipRole,
  InstitutionStaffMembershipStatus,
} from './models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from './schemas/institution-staff-membership.schema';

@Injectable()
export class InstitutionStaffMembershipsService {
  private readonly logger = new Logger(InstitutionStaffMembershipsService.name);
  private readonly staffCreators = [
    InstitutionStaffMembershipRole.OWNER,
    InstitutionStaffMembershipRole.ADMIN,
    InstitutionStaffMembershipRole.MANAGER,
  ];

  constructor(
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    private readonly emailJobsService: EmailJobsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toMembershipResponse(
    membership: InstitutionStaffMembershipDocument | any,
  ) {
    return {
      id: membership._id?.toString() ?? membership.id,
      institutionId: membership.institutionId?.toString(),
      userId: membership.userId?.toString(),
      role: membership.role,
      permissions: membership.permissions ?? [],
      status: membership.status,
      invitedByUserId: membership.invitedByUserId?.toString(),
      createdAt: membership.createdAt?.toISOString?.() ?? membership.createdAt,
      updatedAt: membership.updatedAt?.toISOString?.() ?? membership.updatedAt,
    };
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

  async create(
    createInstitutionStaffMembershipDto: CreateInstitutionStaffMembershipDto,
  ) {
    const membership = await this.institutionStaffMembershipModel.create(
      createInstitutionStaffMembershipDto,
    );

    return this.toMembershipResponse(membership);
  }

  async createStaffUser(
    createStaffUserDto: CreateInstitutionStaffUserDto,
    currentUser?: AuthenticatedUser,
  ) {
    const institutionId = this.toObjectId(createStaffUserDto.institutionId);

    if (!currentUser) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const currentUserRoles = currentUser.roles ?? [];

    if (!currentUserRoles.includes(UserRole.PLATFORM_ADMIN)) {
      const currentMembership = await this.institutionStaffMembershipModel
        .findOne({
          institutionId,
          userId: this.toObjectId(currentUser.sub),
          status: InstitutionStaffMembershipStatus.ACTIVE,
          role: {
            $in: this.staffCreators,
          },
        })
        .lean()
        .exec();

      if (!currentMembership) {
        throw new ForbiddenException(
          'Only institution admins or managers can create staff users',
        );
      }
    }

    const normalizedEmail = createStaffUserDto.email.trim().toLowerCase();
    const passwordMode =
      createStaffUserDto.passwordMode ??
      (createStaffUserDto.password ? 'manual' : 'generated');
    const initialPassword =
      passwordMode === 'generated'
        ? this.generatePassword()
        : (createStaffUserDto.password?.trim() ?? '');
    const passwordChangeRequired =
      passwordMode === 'generated' ||
      Boolean(createStaffUserDto.forcePasswordChange);

    if (!initialPassword || initialPassword.length < 8) {
      throw new BadRequestException('Password must have at least 8 characters');
    }
    assertPasswordPolicy(initialPassword);

    const existingUser = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const activationTokenVersion = randomUUID();
    const user = await this.userModel.create({
      type: UserType.PERSON,
      roles: [
        {
          name: UserRole.INSTITUTION_STAFF,
          grantedAt: new Date(),
          grantedBy: {
            source: 'USER',
            label: currentUser.email,
            userId: this.toObjectId(currentUser.sub),
          },
        },
        {
          name: UserRole.DONOR,
          grantedAt: new Date(),
          grantedBy: {
            source: 'SYSTEM',
            label: 'sistema',
          },
        },
      ],
      fullName: createStaffUserDto.name,
      email: normalizedEmail,
      cpf: createStaffUserDto.cpf?.replace(/\D/g, ''),
      birthDate: createStaffUserDto.birthDate
        ? new Date(createStaffUserDto.birthDate)
        : undefined,
      phone: createStaffUserDto.phone?.replace(/\D/g, ''),
      passwordHash: await hash(initialPassword, 10),
      passwordChangeRequired,
      activationTokenVersion,
      status: UserStatus.PENDING_VERIFICATION,
      isVerified: false,
    });

    const membership = await this.institutionStaffMembershipModel.create({
      institutionId,
      userId: user._id,
      role: createStaffUserDto.role ?? InstitutionStaffMembershipRole.VOLUNTEER,
      permissions: createStaffUserDto.permissions ?? [],
      status: InstitutionStaffMembershipStatus.ACTIVE,
      invitedByUserId: this.toObjectId(currentUser.sub),
    });

    await this.queueStaffAccountCreatedEmail({
      email: normalizedEmail,
      initialPassword,
      name: user.fullName,
      passwordChangeRequired,
      activationTokenVersion,
      userId: user._id.toString(),
    });
    await this.audit({
      action: 'institution_staff.user_created',
      actorUserId: currentUser.sub,
      targetId: user._id.toString(),
      targetType: 'user',
      metadata: {
        email: user.email,
        institutionId: institutionId.toString(),
        role: membership.role,
        passwordMode,
        passwordChangeRequired,
      },
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.fullName,
        email: user.email,
        passwordChangeRequired: user.passwordChangeRequired,
        roles: [
          {
            name: 'institution-staff',
            grantedAt: new Date().toISOString(),
            grantedBy: {
              source: 'USER',
              label: currentUser.email,
              userId: currentUser.sub,
            },
          },
          {
            name: 'donor',
            grantedAt: new Date().toISOString(),
            grantedBy: {
              source: 'SYSTEM',
              label: 'sistema',
            },
          },
        ],
      },
      membership: this.toMembershipResponse(membership),
    };
  }

  private async queueStaffAccountCreatedEmail(input: {
    email: string;
    initialPassword: string;
    name: string;
    passwordChangeRequired: boolean;
    activationTokenVersion: string;
    userId: string;
  }) {
    try {
      await this.emailJobsService.sendAccountCreatedEmail({
        accountStatus: 'pending-verification',
        activationUrl: createAccountActivationUrl(
          input.userId,
          input.activationTokenVersion,
        ),
        initialPassword: input.initialPassword,
        name: input.name,
        passwordChangeRequired: input.passwordChangeRequired,
        to: input.email,
        userId: input.userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue staff account created email for user ${input.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll() {
    const memberships = await this.institutionStaffMembershipModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return memberships.map((membership) =>
      this.toMembershipResponse(membership),
    );
  }

  async findMine(currentUser?: AuthenticatedUser) {
    if (!currentUser) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const memberships = await this.institutionStaffMembershipModel
      .find({
        userId: this.toObjectId(currentUser.sub),
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const institutionIds = memberships.map(
      (membership) => membership.institutionId,
    );
    const institutions = await this.institutionModel
      .find({ _id: { $in: institutionIds } })
      .lean()
      .exec();
    const institutionById = new Map(
      institutions.map((institution) => [
        institution._id.toString(),
        institution,
      ]),
    );

    return memberships.map((membership) => {
      const institution = institutionById.get(
        membership.institutionId.toString(),
      );

      return {
        ...this.toMembershipResponse(membership),
        institution: institution
          ? {
              id: institution._id.toString(),
              name: institution.displayName || institution.legalName,
              status: institution.status,
            }
          : undefined,
      };
    });
  }

  async findMyTeam(currentUser?: AuthenticatedUser) {
    const memberships = await this.findMine(currentUser);
    const activeMembership = memberships[0];

    if (!activeMembership?.institutionId) {
      return {
        canCreateStaff: false,
        institution: null,
        members: [],
      };
    }

    const teamMemberships = await this.institutionStaffMembershipModel
      .find({
        institutionId: this.toObjectId(activeMembership.institutionId),
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .sort({ role: 1, createdAt: 1 })
      .lean()
      .exec();
    const userIds = teamMemberships.map((membership) => membership.userId);
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select(
        '_id fullName email profilePhotoUrl status isVerified passwordChangeRequired',
      )
      .lean()
      .exec();
    const userById = new Map(users.map((user) => [user._id.toString(), user]));

    return {
      canCreateStaff: this.staffCreators.includes(activeMembership.role),
      institution: activeMembership.institution ?? null,
      members: teamMemberships.map((membership) => {
        const user = userById.get(membership.userId.toString());

        return {
          ...this.toMembershipResponse(membership),
          user: user
            ? {
                id: user._id.toString(),
                name: user.fullName,
                email: user.email,
                profilePhotoUrl: user.profilePhotoUrl,
                status: user.status,
                isVerified: user.isVerified,
                passwordChangeRequired: user.passwordChangeRequired,
              }
            : undefined,
        };
      }),
    };
  }

  private generatePassword() {
    return `Elo-${randomBytes(6).toString('base64url')}A7`;
  }

  async findOne(id: string) {
    const membership = await this.institutionStaffMembershipModel
      .findById(id)
      .lean()
      .exec();
    return membership ? this.toMembershipResponse(membership) : null;
  }

  async update(
    id: string,
    updateInstitutionStaffMembershipDto: UpdateInstitutionStaffMembershipDto,
  ) {
    const membership = await this.institutionStaffMembershipModel
      .findByIdAndUpdate(id, updateInstitutionStaffMembershipDto, {
        returnDocument: 'after',
      })
      .lean()
      .exec();

    return membership ? this.toMembershipResponse(membership) : null;
  }

  async remove(id: string) {
    await this.institutionStaffMembershipModel.findByIdAndDelete(id).exec();
    return { id };
  }
}
