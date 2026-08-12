import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

import { DonationStatus } from '../donations/models';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole, UserStatus, UserType } from './models';
import { UsersService } from './users.service';

function execResolve<T>(value: T) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function createUserModelMock() {
  return {
    collection: {
      dropIndex: jest.fn().mockResolvedValue(undefined),
    },
    countDocuments: jest.fn().mockReturnValue(execResolve(0)),
    create: jest.fn(),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(execResolve([])),
      }),
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(execResolve([])),
        }),
      }),
    }),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn().mockReturnValue(execResolve(null)),
    findByIdAndUpdate: jest.fn().mockReturnValue(execResolve(null)),
    findOne: jest.fn().mockReturnValue(execResolve(null)),
    findOneAndUpdate: jest.fn().mockReturnValue(execResolve(null)),
    updateMany: jest.fn().mockReturnValue(execResolve({})),
    updateOne: jest.fn().mockReturnValue(execResolve({})),
  };
}

function createDonationModelMock() {
  return {
    countDocuments: jest.fn().mockReturnValue(execResolve(0)),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve([])),
        }),
      }),
    }),
  };
}

function createPostModelMock() {
  return {
    countDocuments: jest.fn().mockReturnValue(execResolve(0)),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve([])),
        }),
      }),
    }),
  };
}

function createAuditLogModelMock() {
  return {
    countDocuments: jest.fn().mockReturnValue(execResolve(0)),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve([])),
        }),
      }),
    }),
  };
}

function createCampaignModelMock() {
  return {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(execResolve([])),
    }),
  };
}

function createInstitutionModelMock() {
  return {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(execResolve([])),
    }),
  };
}

function createService(overrides?: {
  userModel?: ReturnType<typeof createUserModelMock>;
  donationModel?: ReturnType<typeof createDonationModelMock>;
  postModel?: ReturnType<typeof createPostModelMock>;
  auditLogModel?: ReturnType<typeof createAuditLogModelMock>;
  campaignModel?: ReturnType<typeof createCampaignModelMock>;
  institutionModel?: ReturnType<typeof createInstitutionModelMock>;
}) {
  const userModel = overrides?.userModel ?? createUserModelMock();
  const donationModel = overrides?.donationModel ?? createDonationModelMock();
  const postModel = overrides?.postModel ?? createPostModelMock();
  const auditLogModel = overrides?.auditLogModel ?? createAuditLogModelMock();
  const campaignModel = overrides?.campaignModel ?? createCampaignModelMock();
  const institutionModel =
    overrides?.institutionModel ?? createInstitutionModelMock();

  const service = new UsersService(
    userModel as any,
    donationModel as any,
    postModel as any,
    auditLogModel as any,
    campaignModel as any,
    institutionModel as any,
  );

  return {
    auditLogModel,
    campaignModel,
    donationModel,
    institutionModel,
    postModel,
    service,
    userModel,
  };
}

function baseCreateDto(overrides?: Partial<CreateUserDto>): CreateUserDto {
  return {
    email: 'donor@example.com',
    fullName: 'Donor Example',
    passwordHash: 'hashed-password',
    ...overrides,
  } as CreateUserDto;
}

describe('UsersService', () => {
  describe('onModuleInit', () => {
    it('drops the legacy name index and migrates legacy single-role users', async () => {
      const legacyUserId = new Types.ObjectId();
      const userModel = createUserModelMock();
      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(
            execResolve([{ _id: legacyUserId, role: UserRole.DONOR }]),
          ),
        }),
      } as any);
      const { service } = createService({ userModel });

      await service.onModuleInit();

      expect(userModel.collection.dropIndex).toHaveBeenCalledWith('name_1');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: legacyUserId },
        {
          $set: {
            roles: [
              expect.objectContaining({ name: UserRole.DONOR }),
            ],
          },
          $unset: { role: '' },
        },
      );
    });

    it('does not throw when the legacy index is already gone', async () => {
      const userModel = createUserModelMock();
      userModel.collection.dropIndex.mockRejectedValue({
        codeName: 'IndexNotFound',
        code: 27,
      });
      const { service } = createService({ userModel });

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('rethrows unexpected errors while dropping the legacy index', async () => {
      const userModel = createUserModelMock();
      userModel.collection.dropIndex.mockRejectedValue({
        codeName: 'SomethingElse',
        code: 99,
      });
      const { service } = createService({ userModel });

      await expect(service.onModuleInit()).rejects.toEqual(
        expect.objectContaining({ codeName: 'SomethingElse' }),
      );
    });

    it('migrates users with legacy multi-role arrays and users with no role at all', async () => {
      const userWithRoles = {
        _id: new Types.ObjectId(),
        roles: [UserRole.PLATFORM_ADMIN],
      };
      const userWithNoRole = { _id: new Types.ObjectId() };
      const userModel = createUserModelMock();
      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue(execResolve([userWithRoles, userWithNoRole])),
        }),
      } as any);
      const { service } = createService({ userModel });

      await service.onModuleInit();

      expect(userModel.updateOne).toHaveBeenCalledTimes(2);
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: userWithRoles._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            roles: expect.arrayContaining([
              expect.objectContaining({ name: UserRole.PLATFORM_ADMIN }),
              expect.objectContaining({ name: UserRole.DONOR }),
            ]),
          }),
        }),
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: userWithNoRole._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            roles: [expect.objectContaining({ name: UserRole.DONOR })],
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('throws when email is missing', async () => {
      const { service } = createService({});

      await expect(
        service.create(baseCreateDto({ email: undefined as any })),
      ).rejects.toThrow(ConflictException);
    });

    it('throws when the email is already registered', async () => {
      const userModel = createUserModelMock();
      userModel.findOne.mockReturnValue(
        execResolve({ _id: new Types.ObjectId() }),
      );
      const { service } = createService({ userModel });

      await expect(service.create(baseCreateDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws when the cpf is already registered', async () => {
      const userModel = createUserModelMock();
      userModel.findOne
        .mockReturnValueOnce(execResolve(null))
        .mockReturnValueOnce(execResolve({ _id: new Types.ObjectId() }));
      const { service } = createService({ userModel });

      await expect(
        service.create(baseCreateDto({ cpf: '12345678900' })),
      ).rejects.toThrow(ConflictException);
    });

    it('throws when fullName is missing', async () => {
      const { service } = createService({});

      await expect(
        service.create(baseCreateDto({ fullName: '   ' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a user with default donor role when no roles are given', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
      const { service } = createService({ userModel });

      await service.create(baseCreateDto());

      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'donor@example.com',
          type: UserType.PERSON,
          status: UserStatus.ACTIVE,
          isVerified: true,
          roles: [
            expect.objectContaining({ name: UserRole.DONOR }),
          ],
        }),
      );
    });

    it('adds the donor role automatically for privileged roles', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
      const { service } = createService({ userModel });

      await service.create(
        baseCreateDto({ roles: [UserRole.PLATFORM_ADMIN] }),
      );

      const payload = userModel.create.mock.calls[0][0];
      const roleNames = payload.roles.map((role: any) => role.name);
      expect(roleNames).toEqual(
        expect.arrayContaining([UserRole.PLATFORM_ADMIN, UserRole.DONOR]),
      );
    });

    it('normalizes settings and drops preferredRole when not granted', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
      const { service } = createService({ userModel });

      await service.create(
        baseCreateDto({
          roles: [UserRole.DONOR],
          settings: { preferredRole: UserRole.PLATFORM_ADMIN } as any,
        }),
      );

      const payload = userModel.create.mock.calls[0][0];
      expect(payload.settings.preferredRole).toBeUndefined();
    });

    it('keeps preferredRole when it matches a granted role', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
      const { service } = createService({ userModel });

      await service.create(
        baseCreateDto({
          roles: [UserRole.DONOR],
          settings: { preferredRole: UserRole.DONOR } as any,
        }),
      );

      const payload = userModel.create.mock.calls[0][0];
      expect(payload.settings.preferredRole).toBe(UserRole.DONOR);
    });

    it('retries creation after dropping the legacy name index on a name duplicate key error', async () => {
      const userModel = createUserModelMock();
      const created = { _id: new Types.ObjectId() };
      userModel.create
        .mockRejectedValueOnce({ code: 11000, keyPattern: { name: 1 } })
        .mockResolvedValueOnce(created);
      const { service } = createService({ userModel });

      const result = await service.create(baseCreateDto());

      expect(userModel.collection.dropIndex).toHaveBeenCalledWith('name_1');
      expect(userModel.create).toHaveBeenCalledTimes(2);
      expect(result).toBe(created);
    });

    it('converts an email duplicate key error into a ConflictException', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockRejectedValue({
        code: 11000,
        keyPattern: { email: 1 },
      });
      const { service } = createService({ userModel });

      await expect(service.create(baseCreateDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('converts a cpf duplicate key error into a ConflictException', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockRejectedValue({
        code: 11000,
        keyPattern: { cpf: 1 },
      });
      const { service } = createService({ userModel });

      await expect(service.create(baseCreateDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows unrelated errors from creation', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockRejectedValue(new Error('boom'));
      const { service } = createService({ userModel });

      await expect(service.create(baseCreateDto())).rejects.toThrow('boom');
    });

    it('rethrows duplicate key errors for unmapped keys', async () => {
      const userModel = createUserModelMock();
      userModel.create.mockRejectedValue({
        code: 11000,
        keyPattern: { googleId: 1 },
      });
      const { service } = createService({ userModel });

      await expect(service.create(baseCreateDto())).rejects.toEqual(
        expect.objectContaining({ code: 11000 }),
      );
    });
  });

  describe('findByEmail / findByGoogleId', () => {
    it('normalizes the email before searching', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.findByEmail('  Donor@Example.com  ');

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'donor@example.com',
      });
    });

    it('finds a user by googleId', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.findByGoogleId('google-123');

      expect(userModel.findOne).toHaveBeenCalledWith({
        googleId: 'google-123',
      });
    });
  });

  describe('toPublicUser', () => {
    it('strips the passwordHash from the returned user', () => {
      const { service } = createService({});
      const user = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          email: 'donor@example.com',
          passwordHash: 'secret',
        }),
      } as any;

      const publicUser = service.toPublicUser(user);

      expect(publicUser).not.toHaveProperty('passwordHash');
      expect(publicUser.email).toBe('donor@example.com');
    });
  });

  describe('findAll', () => {
    it('returns a plain array when pagination is not requested', async () => {
      const userModel = createUserModelMock();
      const toObject = jest.fn().mockReturnValue({ email: 'a@example.com' });
      userModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue(
              execResolve([{ toObject }]),
            ),
          }),
        }),
      } as any);
      const { service } = createService({ userModel });

      const result = await service.findAll({});

      expect(Array.isArray(result)).toBe(true);
      expect(userModel.countDocuments).not.toHaveBeenCalled();
    });

    it('returns a paginated response with role summary counts', async () => {
      const userModel = createUserModelMock();
      const toObject = jest.fn().mockReturnValue({ email: 'a@example.com' });
      userModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue(
              execResolve([{ toObject }]),
            ),
          }),
        }),
      } as any);
      userModel.countDocuments
        .mockReturnValueOnce(execResolve(1))
        .mockReturnValueOnce(execResolve(2))
        .mockReturnValueOnce(execResolve(3))
        .mockReturnValueOnce(execResolve(4));
      const { service } = createService({ userModel });

      const result: any = await service.findAll({ page: '1', search: 'ana' });

      expect(result.summary).toEqual({
        donorsCount: 2,
        institutionStaffCount: 3,
        platformAdminsCount: 4,
      });
      expect(result.meta.total).toBe(1);
      expect(userModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { fullName: { $regex: 'ana', $options: 'i' } },
          ]),
        }),
      );
    });

    it('sorts by createdAt ascending when sort is name', async () => {
      const userModel = createUserModelMock();
      const sortSpy = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(execResolve([])),
        }),
      });
      userModel.find.mockReturnValue({ sort: sortSpy } as any);
      const { service } = createService({ userModel });

      await service.findAll({ sort: 'name' });

      expect(sortSpy).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  describe('findOne', () => {
    it('delegates to findById', async () => {
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(null));
      const { service } = createService({ userModel });

      await service.findOne('user-id');

      expect(userModel.findById).toHaveBeenCalledWith('user-id');
    });
  });

  describe('findAdminDetail', () => {
    it('throws BadRequestException for an invalid id', async () => {
      const { service } = createService({});

      await expect(service.findAdminDetail('not-an-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns null when the user does not exist', async () => {
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(null));
      const { service } = createService({ userModel });

      const result = await service.findAdminDetail(
        new Types.ObjectId().toString(),
      );

      expect(result).toBeNull();
    });

    it('aggregates donations, posts and audit logs for the admin detail view', async () => {
      const userId = new Types.ObjectId();
      const campaignId = new Types.ObjectId();
      const institutionId = new Types.ObjectId();
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(
        execResolve({
          toObject: () => ({
            _id: userId,
            email: 'donor@example.com',
            passwordHash: 'secret',
          }),
        }),
      );

      const donationModel = createDonationModelMock();
      donationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue(
              execResolve([
                {
                  _id: new Types.ObjectId(),
                  campaignId,
                  institutionId,
                  moneyDonation: { amount: 50 },
                  status: DonationStatus.PAID,
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                },
                {
                  _id: new Types.ObjectId(),
                  moneyDonation: undefined,
                  status: undefined,
                  createdAt: new Date('2026-01-02T00:00:00.000Z'),
                },
              ]),
            ),
          }),
        }),
      });
      donationModel.countDocuments.mockReturnValue(execResolve(2));

      const postModel = createPostModelMock();
      postModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue(
              execResolve([
                {
                  _id: new Types.ObjectId(),
                  authorType: 'user',
                  authorId: userId,
                  content: 'hello',
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                },
              ]),
            ),
          }),
        }),
      });
      postModel.countDocuments.mockReturnValue(execResolve(1));

      const auditLogModel = createAuditLogModelMock();
      auditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue(
              execResolve([
                {
                  _id: new Types.ObjectId(),
                  actorUserId: userId,
                  action: 'user.login',
                  targetType: 'user',
                  targetId: userId,
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                },
              ]),
            ),
          }),
        }),
      });
      auditLogModel.countDocuments.mockReturnValue(execResolve(1));

      const campaignModel = createCampaignModelMock();
      campaignModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue(
          execResolve([{ _id: campaignId, title: 'My Campaign' }]),
        ),
      });

      const institutionModel = createInstitutionModelMock();
      institutionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue(
          execResolve([
            { _id: institutionId, displayName: 'Instituicao Example' },
          ]),
        ),
      });

      const { service } = createService({
        auditLogModel,
        campaignModel,
        donationModel,
        institutionModel,
        postModel,
        userModel,
      });

      const result = await service.findAdminDetail(userId.toString());

      expect(result?.user).not.toHaveProperty('passwordHash');
      expect(result?.donations).toHaveLength(2);
      expect(result?.donations[0]).toEqual(
        expect.objectContaining({
          amountCents: 5000,
          amountFormatted: 'R$ 50,00',
          campaignTitle: 'My Campaign',
          institutionName: 'Instituicao Example',
          status: 'completed',
        }),
      );
      expect(result?.donations[1]).toEqual(
        expect.objectContaining({
          amountCents: 0,
          campaignTitle: 'Campanha',
          institutionName: 'Instituição',
          status: 'pending',
        }),
      );
      expect(result?.posts).toHaveLength(1);
      expect(result?.auditLogs).toHaveLength(1);
      expect(result?.stats).toEqual({
        auditLogsCount: 1,
        donationsCount: 2,
        postsCount: 1,
        totalDonatedCents: 5000,
      });
    });
  });

  describe('removeById', () => {
    it('deletes the user by id', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.removeById('user-id');

      expect(userModel.findByIdAndDelete).toHaveBeenCalledWith('user-id');
    });
  });

  describe('upsertDevUser', () => {
    it('upserts a dev user with normalized roles and settings', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.upsertDevUser(
        baseCreateDto({ roles: [UserRole.PLATFORM_ADMIN] }),
      );

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'donor@example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({
            roles: expect.arrayContaining([
              expect.objectContaining({ name: UserRole.PLATFORM_ADMIN }),
              expect.objectContaining({ name: UserRole.DONOR }),
            ]),
          }),
          $unset: { role: '' },
        }),
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );
    });
  });

  describe('updatePreferredRole', () => {
    it('returns null when the user does not exist', async () => {
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(null));
      const { service } = createService({ userModel });

      const result = await service.updatePreferredRole(
        'user-id',
        UserRole.DONOR,
      );

      expect(result).toBeNull();
    });

    it('throws when the preferred role is not granted', async () => {
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(
        execResolve({
          roles: [{ name: UserRole.DONOR }],
          settings: {},
          save: jest.fn(),
        }),
      );
      const { service } = createService({ userModel });

      await expect(
        service.updatePreferredRole('user-id', UserRole.PLATFORM_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets the preferred role and saves the user', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const user = {
        roles: [UserRole.DONOR, UserRole.INSTITUTION_STAFF],
        settings: { privateProfile: true },
        save,
      };
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(user));
      const { service } = createService({ userModel });

      const result = await service.updatePreferredRole(
        'user-id',
        UserRole.INSTITUTION_STAFF,
      );

      expect(save).toHaveBeenCalled();
      expect(result?.settings.preferredRole).toBe(UserRole.INSTITUTION_STAFF);
      expect(result?.settings.privateProfile).toBe(true);
    });
  });

  describe('updateNotificationSettings', () => {
    it('returns null when the user does not exist', async () => {
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(null));
      const { service } = createService({ userModel });

      const result = await service.updateNotificationSettings('user-id', {
        donations: false,
      });

      expect(result).toBeNull();
    });

    it('merges the provided notification categories and saves', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const user = {
        settings: {
          notifications: {
            donations: true,
            campaigns: true,
            conversations: true,
            emailDigestEnabled: false,
          },
        },
        save,
      };
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(user));
      const { service } = createService({ userModel });

      const result = await service.updateNotificationSettings('user-id', {
        campaigns: false,
        emailDigestEnabled: true,
      });

      expect(save).toHaveBeenCalled();
      expect(result?.settings.notifications).toEqual({
        donations: true,
        campaigns: false,
        conversations: true,
        emailDigestEnabled: true,
      });
    });
  });

  describe('update', () => {
    it('updates a user by id and returns the fresh document', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.update('user-id', { fullName: 'New Name' } as any);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id',
        { fullName: 'New Name' },
        { returnDocument: 'after' },
      );
    });
  });

  describe('acceptTerms', () => {
    it('marks the terms as accepted with the given version', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.acceptTerms('user-id', 'v2');

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id',
        {
          $set: expect.objectContaining({
            acceptedTermsVersion: 'v2',
            termsAccepted: true,
            termsAcceptedAt: expect.any(Date),
          }),
        },
        { returnDocument: 'after' },
      );
    });
  });

  describe('registerPushToken', () => {
    it('throws when the token is missing', async () => {
      const { service } = createService({});

      await expect(
        service.registerPushToken('user-id', { token: '   ' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns null when the user does not exist', async () => {
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(null));
      const { service } = createService({ userModel });

      const result = await service.registerPushToken('user-id', {
        token: 'push-token',
      } as any);

      expect(result).toBeNull();
    });

    it('updates an existing push token entry in place', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const existingToken = {
        token: 'push-token',
        appVersion: 'old',
        deviceId: 'old-device',
        platform: 'android',
        lastSeenAt: new Date('2020-01-01'),
        disabledAt: new Date('2020-01-02'),
      };
      const user = { pushTokens: [existingToken], save };
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(user));
      const { service } = createService({ userModel });

      const result = await service.registerPushToken('user-id', {
        token: 'push-token',
        appVersion: '2.0',
        deviceId: 'device-1',
        platform: 'ios',
      } as any);

      expect(result).toEqual({ registered: true });
      expect(existingToken.appVersion).toBe('2.0');
      expect(existingToken.deviceId).toBe('device-1');
      expect(existingToken.platform).toBe('ios');
      expect(existingToken.disabledAt).toBeUndefined();
      expect(user.pushTokens).toHaveLength(1);
      expect(save).toHaveBeenCalled();
      expect(userModel.updateMany).toHaveBeenCalledWith(
        { _id: { $ne: 'user-id' }, 'pushTokens.token': 'push-token' },
        { $set: { 'pushTokens.$.disabledAt': expect.any(Date) } },
      );
    });

    it('adds a new push token and keeps only the last 12', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const existingTokens = Array.from({ length: 12 }, (_, index) => ({
        token: `token-${index}`,
      }));
      const user = { pushTokens: existingTokens, save };
      const userModel = createUserModelMock();
      userModel.findById = jest.fn().mockReturnValue(execResolve(user));
      const { service } = createService({ userModel });

      await service.registerPushToken('user-id', {
        token: 'new-token',
        platform: undefined,
      } as any);

      expect(user.pushTokens).toHaveLength(12);
      expect(user.pushTokens[11].token).toBe('new-token');
      expect(user.pushTokens[11].platform).toBe('unknown');
      expect(user.pushTokens[0].token).toBe('token-1');
    });
  });

  describe('unregisterPushToken', () => {
    it('throws when the token is missing', async () => {
      const { service } = createService({});

      await expect(
        service.unregisterPushToken('user-id', { token: '' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('disables the matching push token', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      const result = await service.unregisterPushToken('user-id', {
        token: 'push-token',
      } as any);

      expect(result).toEqual({ unregistered: true });
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: 'user-id', 'pushTokens.token': 'push-token' },
        { $set: { 'pushTokens.$.disabledAt': expect.any(Date) } },
      );
    });
  });

  describe('markTermsPendingForVersionChange', () => {
    it('resets termsAccepted for all users', async () => {
      const userModel = createUserModelMock();
      const { service } = createService({ userModel });

      await service.markTermsPendingForVersionChange();

      expect(userModel.updateMany).toHaveBeenCalledWith(
        {},
        { $set: { termsAccepted: false } },
      );
    });
  });

  describe('remove', () => {
    it('returns a placeholder message', () => {
      const { service } = createService({});

      expect(service.remove('42')).toBe('This action removes a #42 user');
    });
  });
});
