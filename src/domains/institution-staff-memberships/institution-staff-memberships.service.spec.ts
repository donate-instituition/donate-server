import { Types } from 'mongoose';

import { UserRole, UserStatus } from '../users/models';
import { InstitutionStaffMembershipRole } from './models';
import { InstitutionStaffMembershipsService } from './institution-staff-memberships.service';

describe('InstitutionStaffMembershipsService', () => {
  it('creates staff users pending verification and queues activation email', async () => {
    const institutionStaffMembershipModel = {
      create: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        institutionId: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        role: InstitutionStaffMembershipRole.VOLUNTEER,
        permissions: [],
        status: 'ACTIVE',
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
        updatedAt: new Date('2026-08-02T00:00:00.000Z'),
      }),
    };
    const createdUserId = new Types.ObjectId();
    const userModel = {
      create: jest.fn().mockResolvedValue({
        _id: createdUserId,
        fullName: 'Staff Example',
        email: 'staff@example.com',
        activationTokenVersion: 'activation-version',
      }),
      findOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    const emailJobsService = {
      sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new InstitutionStaffMembershipsService(
      institutionStaffMembershipModel as never,
      userModel as never,
      {} as never,
      emailJobsService as never,
      auditLogsService as never,
    );

    await service.createStaffUser(
      {
        email: 'staff@example.com',
        institutionId: new Types.ObjectId().toString(),
        name: 'Staff Example',
        password: 'Secret123',
        forcePasswordChange: true,
      },
      {
        sub: new Types.ObjectId().toString(),
        email: 'admin@example.com',
        roles: [UserRole.PLATFORM_ADMIN],
      } as never,
    );

    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: UserStatus.PENDING_VERIFICATION,
        isVerified: false,
        passwordChangeRequired: true,
      }),
    );
    expect(emailJobsService.sendAccountCreatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        accountStatus: 'pending-verification',
        activationUrl: expect.stringContaining('/auth/activate-account?token='),
        initialPassword: 'Secret123',
        passwordChangeRequired: true,
        to: 'staff@example.com',
        userId: createdUserId.toString(),
      }),
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'institution_staff.user_created',
        targetType: 'user',
      }),
    );
  });

  it('denies staff user creation for volunteer members', async () => {
    const institutionStaffMembershipModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    };
    const service = new InstitutionStaffMembershipsService(
      institutionStaffMembershipModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createStaffUser(
        {
          email: 'staff@example.com',
          institutionId: new Types.ObjectId().toString(),
          name: 'Staff Example',
          password: 'Secret123',
        },
        {
          sub: new Types.ObjectId().toString(),
          email: 'volunteer@example.com',
          roles: [UserRole.INSTITUTION_STAFF],
        } as never,
      ),
    ).rejects.toThrow(
      'Only institution admins or managers can create staff users',
    );
  });

  it('lists the current institution team with user details and permissions', async () => {
    const institutionId = new Types.ObjectId();
    const currentUserId = new Types.ObjectId();
    const teammateId = new Types.ObjectId();
    const membership = {
      _id: new Types.ObjectId(),
      institutionId,
      userId: currentUserId,
      role: InstitutionStaffMembershipRole.ADMIN,
      permissions: [],
      status: 'ACTIVE',
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    };
    const teamMembership = {
      ...membership,
      _id: new Types.ObjectId(),
      userId: teammateId,
      role: InstitutionStaffMembershipRole.VOLUNTEER,
    };
    const institutionStaffMembershipModel = {
      find: jest
        .fn()
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([membership]),
            }),
          }),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([membership, teamMembership]),
            }),
          }),
        }),
    };
    const userModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: teammateId,
                email: 'volunteer@example.com',
                fullName: 'Volunteer Example',
                isVerified: true,
                status: UserStatus.ACTIVE,
              },
            ]),
          }),
        }),
      }),
    };
    const institutionModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              _id: institutionId,
              displayName: 'Instituicao Example',
              status: 'ACTIVE',
            },
          ]),
        }),
      }),
    };
    const service = new InstitutionStaffMembershipsService(
      institutionStaffMembershipModel as never,
      userModel as never,
      institutionModel as never,
      {} as never,
      {} as never,
    );

    const response = await service.findMyTeam({
      sub: currentUserId.toString(),
      email: 'admin@example.com',
      roles: [UserRole.INSTITUTION_STAFF],
    } as never);

    expect(response.canCreateStaff).toBe(true);
    expect(response.institution).toEqual(
      expect.objectContaining({
        name: 'Instituicao Example',
      }),
    );
    expect(response.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'volunteer@example.com',
            name: 'Volunteer Example',
          }),
        }),
      ]),
    );
  });
});
