import { hash } from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { UserRole, UserStatus, UserType } from '../domains/users/models';
import type { UsersService } from '../domains/users/users.service';
import { AuthService } from './auth.service';
import { createAccountActivationToken } from './account-activation';
import type { AuthenticatedUser } from './types/authenticated-user.type';

// In-memory stand-in for RedisService, so these tests don't need a live
// Redis connection. Only implements what AuthService actually calls.
function createFakeRedisService() {
  const store = new Map<string, { value: unknown; expiresAt: number }>();

  return {
    del(key: string) {
      return Promise.resolve(store.delete(key) ? 1 : 0);
    },
    get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry || entry.expiresAt <= Date.now()) return Promise.resolve(null);
      return Promise.resolve(entry.value as T);
    },
    pttl(key: string): Promise<number | null> {
      const entry = store.get(key);
      if (!entry) return Promise.resolve(null);
      const remaining = entry.expiresAt - Date.now();
      return Promise.resolve(remaining > 0 ? remaining : null);
    },
    set<T>(key: string, value: T, ttlSeconds?: number) {
      store.set(key, {
        value,
        expiresAt: Date.now() + (ttlSeconds ?? 3600) * 1000,
      });
      return Promise.resolve();
    },
  };
}

describe('AuthService', () => {
  function createAuthService(overrides: {
    auditLogsService?: { create: jest.Mock };
    appSettingsService?: Record<string, jest.Mock>;
    emailJobsService?: Record<string, jest.Mock>;
    institutionModel?: Record<string, unknown>;
    institutionStaffMembershipModel?: Record<string, unknown>;
    redisService?: ReturnType<typeof createFakeRedisService>;
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
      (overrides.auditLogsService ?? {
        create: jest.fn().mockResolvedValue({}),
      }) as never,
      (overrides.appSettingsService ?? {
        getString: jest
          .fn()
          .mockImplementation((_, fallback) => Promise.resolve(fallback)),
      }) as never,
      (overrides.refreshTokenSessionModel ?? {}) as never,
      (overrides.institutionModel ?? {}) as never,
      (overrides.institutionStaffMembershipModel ?? {}) as never,
      (overrides.redisService ?? createFakeRedisService()) as never,
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
      find: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      }),
      findByIdAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      updateMany: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
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
    const authService = createAuthService({
      usersService: usersService as never,
    });

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

  describe('password reset via Redis', () => {
    function createPasswordResetUsersService(userId: Types.ObjectId) {
      return {
        findByEmail: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'donor@example.com',
          fullName: 'Donor Example',
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({ fullName: 'Donor Example' }),
      };
    }

    function createRefreshTokenSessionModel() {
      return {
        updateMany: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      };
    }

    it('stores a hashed code in Redis and emails it', async () => {
      const userId = new Types.ObjectId();
      const usersService = createPasswordResetUsersService(userId);
      const emailJobsService = {
        sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
      };
      const redisService = createFakeRedisService();
      const authService = createAuthService({
        emailJobsService,
        redisService,
        usersService,
      });

      await authService.forgotPassword({ email: 'donor@example.com' });

      expect(emailJobsService.sendPasswordResetCodeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.stringMatching(/^\d{6}$/),
          to: 'donor@example.com',
        }),
      );
      const stored = await redisService.get('password-reset:donor@example.com');
      expect(stored).toEqual(expect.objectContaining({ attempts: 0 }));
    });

    it('increments attempts on a wrong code without resetting the TTL, then accepts the right one', async () => {
      const userId = new Types.ObjectId();
      const usersService = createPasswordResetUsersService(userId);
      const emailJobsService = {
        sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
        sendTemporaryPasswordEmail: jest.fn().mockResolvedValue(undefined),
      };
      const redisService = createFakeRedisService();
      const refreshTokenSessionModel = createRefreshTokenSessionModel();
      const authService = createAuthService({
        emailJobsService,
        redisService,
        refreshTokenSessionModel,
        usersService,
      });

      await authService.forgotPassword({ email: 'donor@example.com' });
      const code = (
        emailJobsService.sendPasswordResetCodeEmail.mock.calls[0][0] as {
          code: string;
        }
      ).code;
      const wrongCode = code === '000000' ? '111111' : '000000';

      await expect(
        authService.confirmForgotPassword({
          email: 'donor@example.com',
          code: wrongCode,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PASSWORD_RESET_CODE_INVALID',
        }),
      });

      const afterWrongGuess = await redisService.get<{ attempts: number }>(
        'password-reset:donor@example.com',
      );
      expect(afterWrongGuess?.attempts).toBe(1);

      const response = await authService.confirmForgotPassword({
        email: 'donor@example.com',
        code,
      });

      expect(response.message).toContain('senha temporária');
      expect(usersService.update).toHaveBeenCalledWith(
        userId.toString(),
        expect.objectContaining({ passwordChangeRequired: true }),
      );
      expect(
        await redisService.get('password-reset:donor@example.com'),
      ).toBeNull();
    });

    it('rejects confirmation once attempts reach the limit', async () => {
      const userId = new Types.ObjectId();
      const usersService = createPasswordResetUsersService(userId);
      const emailJobsService = {
        sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
      };
      const redisService = createFakeRedisService();
      const authService = createAuthService({
        emailJobsService,
        redisService,
        usersService,
      });

      await authService.forgotPassword({ email: 'donor@example.com' });
      const code = (
        emailJobsService.sendPasswordResetCodeEmail.mock.calls[0][0] as {
          code: string;
        }
      ).code;
      const wrongCode = code === '000000' ? '111111' : '000000';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(
          authService.confirmForgotPassword({
            email: 'donor@example.com',
            code: wrongCode,
          }),
        ).rejects.toBeDefined();
      }

      // Even the correct code is now rejected — the record maxed out attempts.
      await expect(
        authService.confirmForgotPassword({ email: 'donor@example.com', code }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PASSWORD_RESET_CODE_INVALID',
        }),
      });
    });
  });
});
