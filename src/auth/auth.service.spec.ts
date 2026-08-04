import { hash } from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { UserRole, UserStatus, UserType } from '../domains/users/models';
import type { UsersService } from '../domains/users/users.service';
import { AuthService } from './auth.service';
import { createAccountActivationToken } from './account-activation';
import type { AuthenticatedUser } from './types/authenticated-user.type';

describe('AuthService', () => {
  function createAuthService(overrides: {
    auditLogsService?: { create: jest.Mock };
    appSettingsService?: Record<string, jest.Mock>;
    emailJobsService?: Record<string, jest.Mock>;
    institutionModel?: Record<string, unknown>;
    institutionStaffMembershipModel?: Record<string, unknown>;
    passwordResetRequestModel?: Record<string, unknown>;
    refreshTokenSessionModel?: Record<string, unknown>;
    usersService?: Record<string, unknown>;
  }) {
    return new AuthService(
      overrides.usersService as never,
      {
        sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
        sendTemporaryPasswordEmail: jest.fn().mockResolvedValue(undefined),
        ...(overrides.emailJobsService ?? {}),
      } as never,
      (overrides.auditLogsService ?? { create: jest.fn().mockResolvedValue({}) }) as never,
      (overrides.appSettingsService ?? {
        getString: jest.fn().mockImplementation((_, fallback) => Promise.resolve(fallback)),
      }) as never,
      (overrides.refreshTokenSessionModel ?? {}) as never,
      (overrides.passwordResetRequestModel ?? {}) as never,
      (overrides.institutionModel ?? {}) as never,
      (overrides.institutionStaffMembershipModel ?? {}) as never,
    );
  }

  it('grants access when login credentials are valid', async () => {
    const userId = new Types.ObjectId();
    const passwordHash = await hash('secret-password', 10);
    const publicUser = {
      _id: userId,
      email: 'donor@example.com',
      type: UserType.PERSON,
      status: UserStatus.ACTIVE,
      roles: [
        {
          name: UserRole.DONOR,
          grantedAt: new Date('2026-08-02T00:00:00.000Z'),
          grantedBy: {
            source: 'SYSTEM',
            label: 'sistema',
          },
        },
      ],
    };
    const user = {
      ...publicUser,
      _id: userId,
      passwordHash,
      fullName: 'Donor Example',
      name: 'Donor Example',
    };
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
      toPublicUser: jest.fn().mockReturnValue(publicUser),
    } as unknown as UsersService;
    const refreshTokenSessionModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const passwordResetRequestModel = {};
    const emailJobsService = {
      sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
      sendTemporaryPasswordEmail: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({}),
    };
    const authService = createAuthService({
      auditLogsService,
      emailJobsService,
      passwordResetRequestModel,
      refreshTokenSessionModel,
      usersService: usersService as never,
    });

    const response = await authService.login({
      email: 'donor@example.com',
      password: 'secret-password',
    });
    const payload = verify(
      response.accessToken,
      env.jwtSecret,
    ) as AuthenticatedUser;

    expect(response.user).toEqual(
      expect.objectContaining({
        id: userId.toString(),
        name: 'Donor Example',
        email: 'donor@example.com',
        roles: [
          expect.objectContaining({
            name: 'donor',
            grantedBy: {
              source: 'SYSTEM',
              label: 'sistema',
            },
          }),
        ],
      }),
    );
    expect(payload.sub).toBe(userId.toString());
    expect(payload.roles).toEqual([UserRole.DONOR]);
    expect(payload.type).toBe(UserType.PERSON);
    expect(payload.status).toBe(UserStatus.ACTIVE);
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login',
        targetType: 'user',
      }),
    );
  });

  it('denies login when the account is pending verification', async () => {
    const userId = new Types.ObjectId();
    const passwordHash = await hash('secret-password', 10);
    const user = {
      _id: userId,
      email: 'pending@example.com',
      passwordHash,
      fullName: 'Pending Example',
      status: UserStatus.PENDING_VERIFICATION,
      type: UserType.PERSON,
      roles: [UserRole.DONOR],
    };
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
    } as unknown as UsersService;
    const authService = createAuthService({ usersService: usersService as never });

    await expect(
      authService.login({
        email: 'pending@example.com',
        password: 'secret-password',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ACCOUNT_PENDING_VERIFICATION',
      }),
    });
  });

  it('activates accounts only when token version matches the stored version', async () => {
    const userId = new Types.ObjectId();
    const usersService = {
      findOne: jest.fn().mockResolvedValue({
        _id: userId,
        activationTokenVersion: 'version-1',
        email: 'donor@example.com',
        isVerified: false,
        status: UserStatus.PENDING_VERIFICATION,
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
    const authService = createAuthService({
      auditLogsService,
      usersService,
    });

    const response = await authService.activateAccount({
      token: createAccountActivationToken(userId.toString(), 'version-1'),
    });

    expect(response.status).toBe('active');
    expect(usersService.update).toHaveBeenCalledWith(
      userId.toString(),
      expect.objectContaining({
        activationTokenVersion: null,
        isVerified: true,
        status: UserStatus.ACTIVE,
      }),
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.account_activated',
      }),
    );
  });

  it('rejects account activation when token version is stale', async () => {
    const userId = new Types.ObjectId();
    const usersService = {
      findOne: jest.fn().mockResolvedValue({
        _id: userId,
        activationTokenVersion: 'new-version',
        email: 'donor@example.com',
        isVerified: false,
        status: UserStatus.PENDING_VERIFICATION,
      }),
      update: jest.fn(),
    };
    const authService = createAuthService({ usersService });

    await expect(
      authService.activateAccount({
        token: createAccountActivationToken(userId.toString(), 'old-version'),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
      }),
    });
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('rotates activation token version when resending activation email', async () => {
    const userId = new Types.ObjectId();
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue({
        _id: userId,
        email: 'pending@example.com',
        fullName: 'Pending Example',
        status: UserStatus.PENDING_VERIFICATION,
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    const emailJobsService = {
      sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
    const authService = createAuthService({
      auditLogsService,
      emailJobsService,
      usersService,
    });

    await authService.resendActivationEmail({ email: 'pending@example.com' });

    expect(usersService.update).toHaveBeenCalledWith(
      userId.toString(),
      expect.objectContaining({
        activationTokenVersion: expect.any(String),
      }),
    );
    expect(emailJobsService.sendAccountCreatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        activationUrl: expect.stringContaining('/auth/activate-account?token='),
      }),
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.activation_resent',
      }),
    );
  });
});
