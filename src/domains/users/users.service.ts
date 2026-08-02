import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateUserDto, type UserRoleGrantInput } from './dto/create-user.dto';
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

function normalizeRoleGrants(roles?: Array<UserRole | UserRoleGrantInput>): UserRoleGrant[] {
  const roleNames = uniqueRoles((roles?.length ? roles : [UserRole.DONOR]).map(getRoleName));

  if (
    (roleNames.includes(UserRole.PLATFORM_ADMIN) || roleNames.includes(UserRole.INSTITUTION_STAFF)) &&
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

function normalizeSettings(settings: CreateUserDto['settings'] | UpdateUserDto['settings'] | undefined, roles: UserRoleGrant[]) {
  if (!settings) {
    return undefined;
  }

  const roleNames = roles.map((role) => role.name);
  const preferredRole = settings.preferredRole && roleNames.includes(settings.preferredRole)
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
  ) { }

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
    return typeof error === 'object' && error !== null && 'code' in error && (error as MongoDuplicateKeyError).code === 11000;
  }

  async onModuleInit() {
    await this.dropLegacyNameIndex();

    const users = await this.userModel.find().select('_id role roles').lean().exec() as LegacyUserRoleDocument[];

    await Promise.all(
      users.map((user) => {
        const rawRoles = Array.isArray(user.roles) && user.roles.length
          ? user.roles
          : user.role
            ? [user.role]
            : [UserRole.DONOR];

        const roleGrants = normalizeRoleGrants(rawRoles as Array<UserRole | UserRoleGrantInput>);

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

    const existingUser = await this.userModel.findOne({ email: normalizedEmail }).exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (createUserDto.cpf) {
      const existingCpf = await this.userModel.findOne({ cpf: createUserDto.cpf }).exec();

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
      status: createUserDto.status ?? UserStatus.ACTIVE,
      isVerified: createUserDto.isVerified ?? true,
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

  toPublicUser(user: UserDocument): PublicUser {
    const { passwordHash, ...publicUser } = user.toObject();
    void passwordHash;

    return publicUser;
  }

  async findAll() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toPublicUser(user));
  }

  findOne(id: string) {
    return this.userModel.findById(id).exec();
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
            status: createUserDto.status ?? UserStatus.ACTIVE,
            isVerified: createUserDto.isVerified ?? true,
            ...(settings ? { settings } : {}),
          },
          $unset: { role: '' },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async updatePreferredRole(id: string, preferredRole: UserRole) {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      return null;
    }

    const roles = normalizeRoleGrants(user.roles as Array<UserRole | UserRoleGrantInput>);
    const roleNames = roles.map((role) => role.name);

    if (!roleNames.includes(preferredRole)) {
      throw new BadRequestException('Preferred role is not available for this user');
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
    void updateUserDto;
    return `This action updates a #${id} user`;
  }

  remove(id: string) {
    return `This action removes a #${id} user`;
  }
}
