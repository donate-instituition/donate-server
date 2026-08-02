import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { hash } from 'bcryptjs';
import { Model, Types } from 'mongoose';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from '../users/models';
import { User, UserDocument } from '../users/schemas/user.schema';
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
  constructor(
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toMembershipResponse(membership: InstitutionStaffMembershipDocument | any) {
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
            $in: [
              InstitutionStaffMembershipRole.OWNER,
              InstitutionStaffMembershipRole.ADMIN,
            ],
          },
        })
        .lean()
        .exec();

      if (!currentMembership) {
        throw new ForbiddenException('Only institution owners or admins can create staff users');
      }
    }

    const normalizedEmail = createStaffUserDto.email.trim().toLowerCase();
    const existingUser = await this.userModel.findOne({ email: normalizedEmail }).exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

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
      passwordHash: await hash(createStaffUserDto.password, 10),
      status: UserStatus.ACTIVE,
      isVerified: true,
    });

    const membership = await this.institutionStaffMembershipModel.create({
      institutionId,
      userId: user._id,
      role: createStaffUserDto.role ?? InstitutionStaffMembershipRole.VOLUNTEER,
      permissions: createStaffUserDto.permissions ?? [],
      status: InstitutionStaffMembershipStatus.ACTIVE,
      invitedByUserId: this.toObjectId(currentUser.sub),
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.fullName,
        email: user.email,
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

  async findAll() {
    const memberships = await this.institutionStaffMembershipModel.find().sort({ createdAt: -1 }).lean().exec();
    return memberships.map((membership) => this.toMembershipResponse(membership));
  }

  async findOne(id: string) {
    const membership = await this.institutionStaffMembershipModel.findById(id).lean().exec();
    return membership ? this.toMembershipResponse(membership) : null;
  }

  async update(
    id: string,
    updateInstitutionStaffMembershipDto: UpdateInstitutionStaffMembershipDto,
  ) {
    const membership = await this.institutionStaffMembershipModel
      .findByIdAndUpdate(id, updateInstitutionStaffMembershipDto, { new: true })
      .lean()
      .exec();

    return membership ? this.toMembershipResponse(membership) : null;
  }

  async remove(id: string) {
    await this.institutionStaffMembershipModel.findByIdAndDelete(id).exec();
    return { id };
  }
}
