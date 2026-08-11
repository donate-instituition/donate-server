import { hash } from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { UserRole, UserStatus, UserType } from '../domains/users/models';
import type { UsersService } from '../domains/users/users.service';
import { AuthService } from './auth.service';
import { createAccountActivationToken } from './account-activation';
import { createGoogleOnboardingToken } from './google-onboarding-token';
import type { AuthenticatedUser } from './types/authenticated-user.type';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

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

  describe('loginWithGoogle', () => {
    beforeEach(() => {
      mockVerifyIdToken.mockReset();
    });

    it('logs in directly when the Google sub is already linked', async () => {
      const userId = new Types.ObjectId();
      const user = {
        _id: userId,
        email: 'donor@example.com',
        fullName: 'Donor Example',
        status: UserStatus.ACTIVE,
        type: UserType.PERSON,
        roles: [UserRole.DONOR],
        googleId: 'google-sub-1',
        profilePhotoUrl: 'https://existing-photo',
      };
      const usersService = {
        findByGoogleId: jest.fn().mockResolvedValue(user),
        findByEmail: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const refreshTokenSessionModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-1',
          email: 'donor@example.com',
          email_verified: true,
          name: 'Donor Example',
          picture: 'https://new-photo',
        }),
      });
      const authService = createAuthService({
        refreshTokenSessionModel,
        usersService,
      });

      const response = await authService.loginWithGoogle({
        idToken: 'fake-id-token',
      });

      if ('status' in response) throw new Error('Expected a session response');

      expect(response.accessToken).toBeDefined();
      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('links Google to a matching email account without overwriting an existing photo', async () => {
      const userId = new Types.ObjectId();
      const existingUser = {
        _id: userId,
        email: 'donor@example.com',
        fullName: 'Donor Example',
        status: UserStatus.ACTIVE,
        type: UserType.PERSON,
        roles: [UserRole.DONOR],
        profilePhotoUrl: 'https://existing-photo',
      };
      const usersService = {
        findByGoogleId: jest.fn().mockResolvedValue(null),
        findByEmail: jest.fn().mockResolvedValue(existingUser),
        update: jest.fn().mockResolvedValue({
          ...existingUser,
          googleId: 'google-sub-2',
        }),
      };
      const refreshTokenSessionModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-2',
          email: 'donor@example.com',
          email_verified: true,
          name: 'Donor Example',
          picture: 'https://google-photo',
        }),
      });
      const authService = createAuthService({
        refreshTokenSessionModel,
        usersService,
      });

      const response = await authService.loginWithGoogle({
        idToken: 'fake-id-token',
      });

      if ('status' in response) throw new Error('Expected a session response');

      expect(usersService.update).toHaveBeenCalledWith(userId.toString(), {
        googleId: 'google-sub-2',
      });
      expect(response.accessToken).toBeDefined();
    });

    it('uses the Google photo as a fallback only when the account has none yet', async () => {
      const userId = new Types.ObjectId();
      const existingUser = {
        _id: userId,
        email: 'donor@example.com',
        fullName: 'Donor Example',
        status: UserStatus.ACTIVE,
        type: UserType.PERSON,
        roles: [UserRole.DONOR],
        profilePhotoUrl: undefined,
      };
      const usersService = {
        findByGoogleId: jest.fn().mockResolvedValue(null),
        findByEmail: jest.fn().mockResolvedValue(existingUser),
        update: jest.fn().mockResolvedValue({
          ...existingUser,
          googleId: 'google-sub-2',
          profilePhotoUrl: 'https://google-photo',
        }),
      };
      const refreshTokenSessionModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-2',
          email: 'donor@example.com',
          email_verified: true,
          name: 'Donor Example',
          picture: 'https://google-photo',
        }),
      });
      const authService = createAuthService({
        refreshTokenSessionModel,
        usersService,
      });

      await authService.loginWithGoogle({ idToken: 'fake-id-token' });

      expect(usersService.update).toHaveBeenCalledWith(userId.toString(), {
        googleId: 'google-sub-2',
        profilePhotoUrl: 'https://google-photo',
      });
    });

    it('creates a pending user and returns an onboarding token for a brand-new Google account', async () => {
      const newUserId = new Types.ObjectId();
      const usersService = {
        findByGoogleId: jest.fn().mockResolvedValue(null),
        findByEmail: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          _id: newUserId,
          fullName: 'New Donor',
          email: 'new@example.com',
        }),
      };
      const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-3',
          email: 'new@example.com',
          email_verified: true,
          name: 'New Donor',
          picture: 'https://google-photo',
        }),
      });
      const authService = createAuthService({
        auditLogsService,
        usersService,
      });

      const response = await authService.loginWithGoogle({
        idToken: 'fake-id-token',
      });

      expect(response).toEqual({
        status: 'needs-onboarding',
        onboardingToken: expect.any(String),
        name: 'New Donor',
        email: 'new@example.com',
      });
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'New Donor',
          email: 'new@example.com',
          googleId: 'google-sub-3',
          profilePhotoUrl: 'https://google-photo',
          roles: [UserRole.DONOR],
          status: UserStatus.ACTIVE,
          isVerified: true,
        }),
      );
    });

    it('rejects Google accounts whose email is not verified', async () => {
      const usersService = {
        findByGoogleId: jest.fn(),
        findByEmail: jest.fn(),
      };
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-4',
          email: 'unverified@example.com',
          email_verified: false,
        }),
      });
      const authService = createAuthService({
        usersService,
      });

      await expect(
        authService.loginWithGoogle({ idToken: 'fake-id-token' }),
      ).rejects.toThrow('Google email is not verified');
    });
  });

  describe('completeGoogleOnboarding', () => {
    it('issues a session for a DONOR onboarding without touching institutions', async () => {
      const userId = new Types.ObjectId();
      const pendingUser = {
        _id: userId,
        email: 'new@example.com',
        fullName: 'New Donor',
        status: UserStatus.ACTIVE,
        type: UserType.PERSON,
        roles: [UserRole.DONOR],
      };
      const usersService = {
        findOne: jest.fn().mockResolvedValue(pendingUser),
        update: jest.fn().mockResolvedValue({
          ...pendingUser,
          cpf: '11122233344',
          phone: '61999990000',
        }),
      };
      const refreshTokenSessionModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
      const authService = createAuthService({
        auditLogsService,
        refreshTokenSessionModel,
        usersService,
      });

      const response = await authService.completeGoogleOnboarding({
        onboardingToken: createGoogleOnboardingToken(userId.toString()),
        accountType: 'DONOR',
        cpf: '11122233344',
        birthDate: '1998-02-09',
        phone: '61999990000',
      });

      if ('status' in response) throw new Error('Expected a session response');

      expect(response.accessToken).toBeDefined();
      expect(usersService.update).toHaveBeenCalledWith(
        userId.toString(),
        expect.objectContaining({ cpf: '11122233344', phone: '61999990000' }),
      );
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.account_created' }),
      );
    });

    it('creates the institution and grants INSTITUTION_STAFF for an INSTITUTION onboarding', async () => {
      const userId = new Types.ObjectId();
      const institutionId = new Types.ObjectId();
      const pendingUser = {
        _id: userId,
        email: 'owner@example.com',
        fullName: 'Institution Owner',
        status: UserStatus.ACTIVE,
        type: UserType.PERSON,
        roles: [UserRole.DONOR],
      };
      const usersService = {
        findOne: jest.fn().mockResolvedValue(pendingUser),
        update: jest.fn().mockResolvedValue({
          ...pendingUser,
          cpf: '11122233344',
          phone: '61999990000',
          roles: [UserRole.INSTITUTION_STAFF, UserRole.DONOR],
        }),
      };
      const institutionModel = {
        findOne: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        create: jest.fn().mockResolvedValue({
          _id: institutionId,
          displayName: 'Instituicao Legal',
          status: 'PENDING_APPROVAL',
        }),
        findByIdAndDelete: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      };
      const institutionStaffMembershipModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      const refreshTokenSessionModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
      const authService = createAuthService({
        auditLogsService,
        institutionModel,
        institutionStaffMembershipModel,
        refreshTokenSessionModel,
        usersService,
      });

      const response = await authService.completeGoogleOnboarding({
        onboardingToken: createGoogleOnboardingToken(userId.toString()),
        accountType: 'INSTITUTION',
        cpf: '11122233344',
        birthDate: '1998-02-09',
        phone: '61999990000',
        institutionCnpj: '12.345.678/0001-99',
        institutionLegalName: 'Instituicao Legal',
      });

      expect(institutionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cnpj: '12345678000199',
          legalName: 'Instituicao Legal',
          status: 'PENDING_APPROVAL',
        }),
      );
      expect(institutionStaffMembershipModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId,
          userId,
          role: 'OWNER',
        }),
      );
      expect(usersService.update).toHaveBeenNthCalledWith(
        2,
        userId.toString(),
        {
          roles: [UserRole.INSTITUTION_STAFF, UserRole.DONOR],
        },
      );

      if (!('status' in response)) {
        throw new Error('Expected a pending-approval response');
      }

      expect(response.status).toBe('pending-approval');
      expect(response.institution.name).toBe('Instituicao Legal');
    });

    it('rejects onboarding when CPF is missing', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'new@example.com',
          fullName: 'New Donor',
          status: UserStatus.ACTIVE,
          type: UserType.PERSON,
          roles: [UserRole.DONOR],
        }),
        update: jest.fn(),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'DONOR',
          cpf: '',
          birthDate: '1998-02-09',
          phone: '61999990000',
        }),
      ).rejects.toThrow('CPF is required');
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('rejects onboarding with a CPF already registered to another account', async () => {
      const userId = new Types.ObjectId();
      const duplicateKeyError = Object.assign(new Error('duplicate key'), {
        code: 11000,
        keyPattern: { cpf: 1 },
      });
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'new@example.com',
          fullName: 'New Donor',
          status: UserStatus.ACTIVE,
          type: UserType.PERSON,
          roles: [UserRole.DONOR],
        }),
        update: jest.fn().mockRejectedValue(duplicateKeyError),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'DONOR',
          cpf: '11122233344',
          birthDate: '1998-02-09',
          phone: '61999990000',
        }),
      ).rejects.toThrow('CPF already registered');
    });

    it('rejects a tampered or expired onboarding token', async () => {
      const authService = createAuthService({});

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: 'not-a-real-token',
          accountType: 'DONOR',
          cpf: '11122233344',
          birthDate: '1998-02-09',
          phone: '61999990000',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'GOOGLE_ONBOARDING_TOKEN_INVALID',
        }),
      });
    });
  });
});
