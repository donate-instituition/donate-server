import { hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { InstitutionDonationType, InstitutionStatus } from '../domains/institutions/models';
import {
  InstitutionStaffMembershipRole,
  InstitutionStaffMembershipStatus,
} from '../domains/institution-staff-memberships/models';
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

  describe('updateMySettings', () => {
    function authenticatedUser(userId: Types.ObjectId): AuthenticatedUser {
      return {
        sub: userId.toString(),
        email: 'donor@example.com',
        roles: [UserRole.DONOR],
        type: UserType.PERSON,
        status: UserStatus.ACTIVE,
      };
    }

    it('rejects when neither preferredRole nor notifications is provided', async () => {
      const authService = createAuthService({});

      await expect(
        authService.updateMySettings(
          authenticatedUser(new Types.ObjectId()),
          {},
        ),
      ).rejects.toThrow('Preferred role or notifications is required');
    });

    it('rejects when no authenticated user is present', async () => {
      const authService = createAuthService({});

      await expect(
        authService.updateMySettings(undefined, {
          preferredRole: UserRole.DONOR,
        }),
      ).rejects.toThrow('Authentication token is missing');
    });

    it('updates the preferred role when preferredRole is provided', async () => {
      const userId = new Types.ObjectId();
      const updatedUser = {
        _id: userId,
        email: 'donor@example.com',
        fullName: 'Donor Example',
        roles: [UserRole.DONOR],
        settings: { preferredRole: UserRole.DONOR },
      };
      const usersService = {
        updatePreferredRole: jest.fn().mockResolvedValue(updatedUser),
        updateNotificationSettings: jest.fn(),
      };
      const authService = createAuthService({ usersService });

      const response = await authService.updateMySettings(
        authenticatedUser(userId),
        { preferredRole: UserRole.DONOR },
      );

      expect(usersService.updatePreferredRole).toHaveBeenCalledWith(
        userId.toString(),
        UserRole.DONOR,
      );
      expect(usersService.updateNotificationSettings).not.toHaveBeenCalled();
      expect(response.id).toBe(userId.toString());
    });

    it('updates notification settings when notifications is provided', async () => {
      const userId = new Types.ObjectId();
      const updatedUser = {
        _id: userId,
        email: 'donor@example.com',
        fullName: 'Donor Example',
        roles: [UserRole.DONOR],
        settings: {
          notifications: {
            campaigns: true,
            conversations: true,
            donations: false,
            emailDigestEnabled: false,
          },
        },
      };
      const usersService = {
        updatePreferredRole: jest.fn(),
        updateNotificationSettings: jest.fn().mockResolvedValue(updatedUser),
      };
      const authService = createAuthService({ usersService });

      const response = await authService.updateMySettings(
        authenticatedUser(userId),
        { notifications: { donations: false } },
      );

      expect(usersService.updateNotificationSettings).toHaveBeenCalledWith(
        userId.toString(),
        { donations: false },
      );
      expect(usersService.updatePreferredRole).not.toHaveBeenCalled();
      expect(response.notificationSettings).toEqual(
        updatedUser.settings.notifications,
      );
    });
  });

  describe('register', () => {
    const baseRegisterDto = {
      name: 'Donor Example',
      email: 'donor@example.com',
      password: 'Secret123',
      cpf: '11122233344',
      birthDate: '1998-02-09',
      phone: '61999990000',
    };

    it.each([
      [{ ...baseRegisterDto, name: '' }, 'Name is required'],
      [{ ...baseRegisterDto, email: '' }, 'Email is required'],
      [{ ...baseRegisterDto, password: '' }, 'Password is required'],
      [{ ...baseRegisterDto, password: 'weak' }, 'Password must have at least 8 characters'],
      [{ ...baseRegisterDto, cpf: '' }, 'CPF is required'],
      [{ ...baseRegisterDto, birthDate: '' }, 'Birth date is required'],
      [{ ...baseRegisterDto, phone: '' }, 'Phone is required'],
    ])('rejects registration when a required field is missing (%#)', async (dto, message) => {
      const authService = createAuthService({});

      await expect(authService.register(dto as never)).rejects.toThrow(
        message,
      );
    });

    it('rejects registration when the email is already taken', async () => {
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          roles: [UserRole.DONOR],
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.register(baseRegisterDto as never),
      ).rejects.toThrow('Email already registered');
    });

    it('creates a pending-verification donor account and queues the activation email', async () => {
      const newUserId = new Types.ObjectId();
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          _id: newUserId,
          fullName: 'Donor Example',
          email: 'donor@example.com',
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

      const response = await authService.register(baseRegisterDto as never);

      expect(response).toEqual({
        status: 'pending-verification',
        message: expect.any(String),
        email: 'donor@example.com',
      });
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: [UserRole.DONOR],
          status: UserStatus.PENDING_VERIFICATION,
          termsAccepted: true,
        }),
      );
      expect(usersService.update).toHaveBeenCalledWith(
        newUserId.toString(),
        expect.objectContaining({ activationTokenVersion: expect.any(String) }),
      );
      expect(emailJobsService.sendAccountCreatedEmail).toHaveBeenCalled();
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.account_created' }),
      );
    });

    it('creates a pending-approval institution account and links the requesting user as owner', async () => {
      const newUserId = new Types.ObjectId();
      const institutionId = new Types.ObjectId();
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          _id: newUserId,
          fullName: 'Institution Owner',
          email: 'owner@example.com',
        }),
      };
      const institutionModel = {
        findOne: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        create: jest.fn().mockResolvedValue({
          _id: institutionId,
          displayName: 'Instituicao Legal',
          status: InstitutionStatus.PENDING_APPROVAL,
        }),
      };
      const institutionStaffMembershipModel = {
        create: jest.fn().mockResolvedValue({}),
      };
      const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
      const authService = createAuthService({
        auditLogsService,
        institutionModel,
        institutionStaffMembershipModel,
        usersService,
      });

      const response = await authService.register({
        ...baseRegisterDto,
        name: 'Institution Owner',
        email: 'owner@example.com',
        accountType: 'INSTITUTION',
        institutionCnpj: '12.345.678/0001-99',
        institutionLegalName: 'Instituicao Legal',
      } as never);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: [UserRole.INSTITUTION_STAFF, UserRole.DONOR],
          status: UserStatus.ACTIVE,
        }),
      );
      expect(institutionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cnpj: '12345678000199',
          status: InstitutionStatus.PENDING_APPROVAL,
          acceptedDonationTypes: [InstitutionDonationType.MONEY],
        }),
      );
      expect(institutionStaffMembershipModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId,
          userId: newUserId,
          role: InstitutionStaffMembershipRole.OWNER,
        }),
      );
      expect(response).toEqual({
        status: 'pending-approval',
        message: expect.any(String),
        institution: {
          id: institutionId.toString(),
          name: 'Instituicao Legal',
          status: InstitutionStatus.PENDING_APPROVAL,
        },
      });
    });

    it('re-registers an orphaned institution-staff account instead of rejecting it', async () => {
      const oldUserId = new Types.ObjectId();
      const newUserId = new Types.ObjectId();
      const institutionId = new Types.ObjectId();
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({
          _id: oldUserId,
          roles: [UserRole.INSTITUTION_STAFF, UserRole.DONOR],
        }),
        removeById: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue({
          _id: newUserId,
          fullName: 'Institution Owner',
          email: 'owner@example.com',
        }),
      };
      const institutionModel = {
        findOne: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        create: jest.fn().mockResolvedValue({
          _id: institutionId,
          displayName: 'Instituicao Legal',
          status: InstitutionStatus.PENDING_APPROVAL,
        }),
      };
      const institutionStaffMembershipModel = {
        exists: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        create: jest.fn().mockResolvedValue({}),
      };
      const authService = createAuthService({
        institutionModel,
        institutionStaffMembershipModel,
        usersService,
      });

      await authService.register({
        ...baseRegisterDto,
        name: 'Institution Owner',
        email: 'owner@example.com',
        accountType: 'INSTITUTION',
        institutionCnpj: '12345678000199',
      } as never);

      expect(usersService.removeById).toHaveBeenCalledWith(
        oldUserId.toString(),
      );
      expect(usersService.create).toHaveBeenCalled();
    });

    it('rejects institution registration when the CNPJ is missing', async () => {
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue(null),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.register({
          ...baseRegisterDto,
          accountType: 'INSTITUTION',
        } as never),
      ).rejects.toThrow('Institution CNPJ is required');
    });

    it('rejects institution registration when the CNPJ is already registered', async () => {
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue(null),
      };
      const institutionModel = {
        findOne: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ _id: new Types.ObjectId(), cnpj: '12345678000199' }),
        }),
      };
      const authService = createAuthService({ institutionModel, usersService });

      await expect(
        authService.register({
          ...baseRegisterDto,
          accountType: 'INSTITUTION',
          institutionCnpj: '12345678000199',
        } as never),
      ).rejects.toThrow('Institution CNPJ already registered');
    });

    it('rolls back the created user when institution setup fails', async () => {
      const newUserId = new Types.ObjectId();
      const institutionId = new Types.ObjectId();
      const membershipError = new Error('membership creation failed');
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          _id: newUserId,
          fullName: 'Institution Owner',
          email: 'owner@example.com',
        }),
        removeById: jest.fn().mockResolvedValue(undefined),
      };
      const institutionModel = {
        findOne: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        create: jest.fn().mockResolvedValue({ _id: institutionId }),
        findByIdAndDelete: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      };
      const institutionStaffMembershipModel = {
        create: jest.fn().mockRejectedValue(membershipError),
      };
      const authService = createAuthService({
        institutionModel,
        institutionStaffMembershipModel,
        usersService,
      });

      await expect(
        authService.register({
          ...baseRegisterDto,
          accountType: 'INSTITUTION',
          institutionCnpj: '12345678000199',
        } as never),
      ).rejects.toThrow(membershipError);

      expect(institutionModel.findByIdAndDelete).toHaveBeenCalledWith(
        institutionId,
      );
      expect(usersService.removeById).toHaveBeenCalledWith(
        newUserId.toString(),
      );
    });
  });

  describe('assertCanIssueSession via login', () => {
    async function loginAs(user: Record<string, unknown>, overrides: Parameters<typeof createAuthService>[0] = {}) {
      const passwordHash = await hash('secret-password', 10);
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({ ...user, passwordHash }),
      };
      const authService = createAuthService({ usersService, ...overrides });
      return authService.login({
        email: user.email as string,
        password: 'secret-password',
      });
    }

    it('denies login when the account is suspended', async () => {
      await expect(
        loginAs({
          _id: new Types.ObjectId(),
          email: 'suspended@example.com',
          status: UserStatus.SUSPENDED,
          roles: [UserRole.DONOR],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
      });
    });

    it('denies login when the account is deleted', async () => {
      await expect(
        loginAs({
          _id: new Types.ObjectId(),
          email: 'deleted@example.com',
          status: UserStatus.DELETED,
          roles: [UserRole.DONOR],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ACCOUNT_DELETED' }),
      });
    });

    it('denies institution-staff login when there is no active membership', async () => {
      const institutionStaffMembershipModel = {
        find: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      };

      await expect(
        loginAs(
          {
            _id: new Types.ObjectId(),
            email: 'staff@example.com',
            status: UserStatus.ACTIVE,
            roles: [UserRole.INSTITUTION_STAFF],
          },
          { institutionStaffMembershipModel },
        ),
      ).rejects.toThrow('Institution access is not active');
    });

    it('denies institution-staff login when the institution is not yet approved', async () => {
      const institutionStaffMembershipModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([{ institutionId: new Types.ObjectId() }]),
          }),
        }),
      };
      const institutionModel = {
        findOne: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        }),
      };

      await expect(
        loginAs(
          {
            _id: new Types.ObjectId(),
            email: 'staff@example.com',
            status: UserStatus.ACTIVE,
            roles: [UserRole.INSTITUTION_STAFF],
          },
          { institutionModel, institutionStaffMembershipModel },
        ),
      ).rejects.toThrow('Institution registration is pending approval');
    });

    it('allows institution-staff login when the institution is active and verified', async () => {
      const institutionStaffMembershipModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([{ institutionId: new Types.ObjectId() }]),
          }),
        }),
      };
      const institutionModel = {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
          }),
        }),
      };
      const refreshTokenSessionModel = {
        create: jest.fn().mockResolvedValue({}),
      };

      const response = await loginAs(
        {
          _id: new Types.ObjectId(),
          email: 'staff@example.com',
          status: UserStatus.ACTIVE,
          roles: [UserRole.INSTITUTION_STAFF],
        },
        { institutionModel, institutionStaffMembershipModel, refreshTokenSessionModel },
      );

      expect(response.accessToken).toBeDefined();
    });

    it('denies login with invalid credentials when the user does not exist', async () => {
      const usersService = { findByEmail: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({ usersService });

      await expect(
        authService.login({
          email: 'missing@example.com',
          password: 'whatever123',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('denies login with invalid credentials when the password does not match', async () => {
      const passwordHash = await hash('correct-password', 10);
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          email: 'donor@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roles: [UserRole.DONOR],
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.login({
          email: 'donor@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refresh', () => {
    it('rejects when no refresh token is provided', async () => {
      const authService = createAuthService({});

      await expect(authService.refresh('')).rejects.toThrow(
        'Refresh token is missing',
      );
    });

    it('rejects a malformed refresh token', async () => {
      const authService = createAuthService({});

      await expect(authService.refresh('not-a-jwt')).rejects.toThrow(
        'Refresh token is invalid',
      );
    });

    it('rejects a token that is not a refresh-type token', async () => {
      const authService = createAuthService({});
      const accessLikeToken = sign(
        { sub: 'user-1', type: 'access' },
        env.jwtSecret,
      );

      await expect(authService.refresh(accessLikeToken)).rejects.toThrow(
        'Refresh token is invalid',
      );
    });

    it('rejects when no stored session matches the refresh token hash', async () => {
      const userId = new Types.ObjectId();
      const token = sign(
        { sub: userId.toString(), type: 'refresh' },
        env.jwtSecret,
      );
      const refreshTokenSessionModel = {
        find: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      };
      const authService = createAuthService({ refreshTokenSessionModel });

      await expect(authService.refresh(token)).rejects.toThrow(
        'Refresh token is invalid',
      );
    });

    it('rejects a revoked session even if the hash matches', async () => {
      const userId = new Types.ObjectId();
      const token = sign(
        { sub: userId.toString(), type: 'refresh' },
        env.jwtSecret,
      );
      const revokedHash = await hash(token, 10);
      const refreshTokenSessionModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                refreshTokenHash: revokedHash,
                revokedAt: new Date('2000-01-01T00:00:00.000Z'),
              },
            ]),
          }),
        }),
      };
      const authService = createAuthService({ refreshTokenSessionModel });

      await expect(authService.refresh(token)).rejects.toThrow(
        'Refresh token is invalid',
      );
    });

    it('rejects when the session user no longer exists', async () => {
      const userId = new Types.ObjectId();
      const token = sign(
        { sub: userId.toString(), type: 'refresh' },
        env.jwtSecret,
      );
      const matchingHash = await hash(token, 10);
      const refreshTokenSessionModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([{ refreshTokenHash: matchingHash }]),
          }),
        }),
      };
      const usersService = { findOne: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({
        refreshTokenSessionModel,
        usersService,
      });

      await expect(authService.refresh(token)).rejects.toThrow(
        'Refresh token is invalid',
      );
    });

    it('issues a fresh access token for a valid, unrevoked session', async () => {
      const userId = new Types.ObjectId();
      const token = sign(
        { sub: userId.toString(), type: 'refresh' },
        env.jwtSecret,
      );
      const matchingHash = await hash(token, 10);
      const refreshTokenSessionModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([{ refreshTokenHash: matchingHash }]),
          }),
        }),
      };
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'donor@example.com',
          fullName: 'Donor Example',
          status: UserStatus.ACTIVE,
          type: UserType.PERSON,
          roles: [UserRole.DONOR],
        }),
      };
      const authService = createAuthService({
        refreshTokenSessionModel,
        usersService,
      });

      const response = await authService.refresh(token);

      expect(response.accessToken).toBeDefined();
      expect(response.user).toEqual(
        expect.objectContaining({ email: 'donor@example.com' }),
      );
    });
  });

  describe('logout', () => {
    it('revokes matching sessions by refresh token and writes an audit log', async () => {
      const token = 'a-refresh-token';
      const matchingHash = await hash(token, 10);
      const sessionId = new Types.ObjectId();
      const refreshTokenSessionModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { _id: sessionId, refreshTokenHash: matchingHash },
            ]),
          }),
        }),
        findByIdAndUpdate: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      };
      const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
      const authService = createAuthService({
        auditLogsService,
        refreshTokenSessionModel,
      });

      const response = await authService.logout(token, undefined);

      expect(refreshTokenSessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(response).toEqual({ message: 'Logged out successfully' });
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.logout' }),
      );
    });

    it('revokes all sessions for a user id when no refresh token is given', async () => {
      const userId = new Types.ObjectId().toString();
      const refreshTokenSessionModel = {
        updateMany: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      };
      const authService = createAuthService({ refreshTokenSessionModel });

      await authService.logout(undefined, userId);

      expect(refreshTokenSessionModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          revokedAt: { $exists: false },
        }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('does nothing when neither a refresh token nor a user id is given', async () => {
      const refreshTokenSessionModel = {
        find: jest.fn(),
        updateMany: jest.fn(),
      };
      const authService = createAuthService({ refreshTokenSessionModel });

      const response = await authService.logout(undefined, undefined);

      expect(refreshTokenSessionModel.find).not.toHaveBeenCalled();
      expect(refreshTokenSessionModel.updateMany).not.toHaveBeenCalled();
      expect(response).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('changePassword', () => {
    function authenticatedUser(userId: Types.ObjectId): AuthenticatedUser {
      return {
        sub: userId.toString(),
        email: 'donor@example.com',
        roles: [UserRole.DONOR],
        type: UserType.PERSON,
        status: UserStatus.ACTIVE,
      };
    }

    it('rejects when there is no authenticated user', async () => {
      const authService = createAuthService({});

      await expect(
        authService.changePassword(undefined, {
          currentPassword: 'old-pass1',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow('Authentication token is missing');
    });

    it('rejects when current or new password is missing', async () => {
      const authService = createAuthService({});

      await expect(
        authService.changePassword(authenticatedUser(new Types.ObjectId()), {
          currentPassword: '',
          newPassword: '',
        }),
      ).rejects.toThrow(
        'Current password and new password are required',
      );
    });

    it('rejects a new password that fails the password policy', async () => {
      const authService = createAuthService({});

      await expect(
        authService.changePassword(authenticatedUser(new Types.ObjectId()), {
          currentPassword: 'old-pass1',
          newPassword: 'weak',
        }),
      ).rejects.toThrow('Password must have at least 8 characters');
    });

    it('rejects when the new password matches the current password', async () => {
      const authService = createAuthService({});

      await expect(
        authService.changePassword(authenticatedUser(new Types.ObjectId()), {
          currentPassword: 'SamePass123',
          newPassword: 'SamePass123',
        }),
      ).rejects.toThrow(
        'New password must be different from current password',
      );
    });

    it('rejects when the authenticated user no longer exists', async () => {
      const usersService = { findOne: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({ usersService });

      await expect(
        authService.changePassword(authenticatedUser(new Types.ObjectId()), {
          currentPassword: 'old-pass1',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow('Authentication token is invalid');
    });

    it('rejects when the current password does not match', async () => {
      const userId = new Types.ObjectId();
      const existingPasswordHash = await hash('correct-password', 10);
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          passwordHash: existingPasswordHash,
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.changePassword(authenticatedUser(userId), {
          currentPassword: 'wrong-password',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow('Current password is invalid');
    });

    it('rotates the password, revokes sessions and issues new tokens on success', async () => {
      const userId = new Types.ObjectId();
      const existingPasswordHash = await hash('correct-password', 10);
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          passwordHash: existingPasswordHash,
        }),
        update: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'donor@example.com',
          fullName: 'Donor Example',
          roles: [UserRole.DONOR],
          type: UserType.PERSON,
          status: UserStatus.ACTIVE,
        }),
      };
      const refreshTokenSessionModel = {
        updateMany: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
        create: jest.fn().mockResolvedValue({}),
      };
      const auditLogsService = { create: jest.fn().mockResolvedValue({}) };
      const authService = createAuthService({
        auditLogsService,
        refreshTokenSessionModel,
        usersService,
      });

      const response = await authService.changePassword(
        authenticatedUser(userId),
        { currentPassword: 'correct-password', newPassword: 'NewPass123' },
      );

      expect(usersService.update).toHaveBeenCalledWith(
        userId.toString(),
        expect.objectContaining({ passwordChangeRequired: false }),
      );
      expect(refreshTokenSessionModel.updateMany).toHaveBeenCalled();
      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.password_changed' }),
      );
    });

    it('rejects when the password update unexpectedly returns no user', async () => {
      const userId = new Types.ObjectId();
      const existingPasswordHash = await hash('correct-password', 10);
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          passwordHash: existingPasswordHash,
        }),
        update: jest.fn().mockResolvedValue(null),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.changePassword(authenticatedUser(userId), {
          currentPassword: 'correct-password',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow('Authentication token is invalid');
    });
  });

  describe('activateAccount edge cases', () => {
    it('rejects a blank token', async () => {
      const authService = createAuthService({});

      await expect(
        authService.activateAccount({ token: '   ' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        }),
      });
    });

    it('rejects a malformed token', async () => {
      const authService = createAuthService({});

      await expect(
        authService.activateAccount({ token: 'not-a-real-token' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        }),
      });
    });

    it('rejects when the user in the token no longer exists', async () => {
      const usersService = { findOne: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({ usersService });

      await expect(
        authService.activateAccount({
          token: createAccountActivationToken('missing-user', 'v1'),
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ACCOUNT_ACTIVATION_TOKEN_INVALID',
        }),
      });
    });

    it('does not re-update an already active and verified account', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          activationTokenVersion: 'v1',
          email: 'donor@example.com',
          isVerified: true,
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn(),
      };
      const authService = createAuthService({ usersService });

      const response = await authService.activateAccount({
        token: createAccountActivationToken(userId.toString(), 'v1'),
      });

      expect(response.status).toBe('active');
      expect(usersService.update).not.toHaveBeenCalled();
    });
  });

  describe('resendActivationEmail edge cases', () => {
    it('returns a generic message without a lookup when the email is blank', async () => {
      const usersService = { findByEmail: jest.fn() };
      const authService = createAuthService({ usersService });

      const response = await authService.resendActivationEmail({ email: '' });

      expect(response.message).toContain('novo link de ativação');
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('returns the generic message when the account does not exist', async () => {
      const usersService = { findByEmail: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({ usersService });

      const response = await authService.resendActivationEmail({
        email: 'missing@example.com',
      });

      expect(response.message).toContain('novo link de ativação');
    });

    it('returns the generic message when the account is already active', async () => {
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          email: 'active@example.com',
          status: UserStatus.ACTIVE,
        }),
      };
      const authService = createAuthService({ usersService });

      const response = await authService.resendActivationEmail({
        email: 'active@example.com',
      });

      expect(response.message).toContain('novo link de ativação');
    });
  });

  describe('forgotPassword edge cases', () => {
    it('returns a generic message without a lookup when the email is blank', async () => {
      const usersService = { findByEmail: jest.fn() };
      const authService = createAuthService({ usersService });

      const response = await authService.forgotPassword({ email: '' });

      expect(response.message).toContain('redefinição');
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('returns the generic message when no account matches the email', async () => {
      const usersService = { findByEmail: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({ usersService });

      const response = await authService.forgotPassword({
        email: 'missing@example.com',
      });

      expect(response.message).toContain('redefinição');
    });

    it('returns the generic message for a deleted account without emailing it', async () => {
      const emailJobsService = {
        sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
      };
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          email: 'deleted@example.com',
          status: UserStatus.DELETED,
        }),
      };
      const authService = createAuthService({ emailJobsService, usersService });

      await authService.forgotPassword({ email: 'deleted@example.com' });

      expect(emailJobsService.sendPasswordResetCodeEmail).not.toHaveBeenCalled();
    });
  });

  describe('confirmForgotPassword edge cases', () => {
    it('rejects a malformed reset code', async () => {
      const authService = createAuthService({});

      await expect(
        authService.confirmForgotPassword({
          email: 'donor@example.com',
          code: 'abc',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PASSWORD_RESET_CODE_INVALID',
        }),
      });
    });

    it('rejects when there is no pending reset request', async () => {
      const authService = createAuthService({});

      await expect(
        authService.confirmForgotPassword({
          email: 'donor@example.com',
          code: '123456',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PASSWORD_RESET_CODE_INVALID',
        }),
      });
    });

    it('clears the pending request and returns a generic message when the account was deleted meanwhile', async () => {
      const userId = new Types.ObjectId();
      const redisService = createFakeRedisService();
      const usersService = {
        findByEmail: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'donor@example.com',
          fullName: 'Donor Example',
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn(),
      };
      const emailJobsService = {
        sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(undefined),
      };
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

      // Account gets deleted between the request and the confirmation.
      usersService.findByEmail.mockResolvedValueOnce({
        _id: userId,
        email: 'donor@example.com',
        status: UserStatus.DELETED,
      } as never);

      const response = await authService.confirmForgotPassword({
        email: 'donor@example.com',
        code,
      });

      expect(response.message).toContain('temporária');
      expect(usersService.update).not.toHaveBeenCalled();
      expect(
        await redisService.get('password-reset:donor@example.com'),
      ).toBeNull();
    });
  });

  describe('loginWithGoogle edge cases', () => {
    beforeEach(() => {
      mockVerifyIdToken.mockReset();
    });

    it('rejects when the id token is missing', async () => {
      const authService = createAuthService({});

      await expect(
        authService.loginWithGoogle({ idToken: '  ' }),
      ).rejects.toThrow('Google ID token is missing');
    });

    it('rejects when Google verification throws', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('bad token'));
      const authService = createAuthService({});

      await expect(
        authService.loginWithGoogle({ idToken: 'fake-id-token' }),
      ).rejects.toThrow('Google ID token is invalid');
    });

    it('rejects when the payload is missing sub or email', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({ email_verified: true }),
      });
      const authService = createAuthService({});

      await expect(
        authService.loginWithGoogle({ idToken: 'fake-id-token' }),
      ).rejects.toThrow('Google ID token is invalid');
    });

    it('enforces account status checks for an already-linked Google account', async () => {
      const usersService = {
        findByGoogleId: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          email: 'suspended@example.com',
          status: UserStatus.SUSPENDED,
          roles: [UserRole.DONOR],
        }),
      };
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-1',
          email: 'suspended@example.com',
          email_verified: true,
        }),
      });
      const authService = createAuthService({ usersService });

      await expect(
        authService.loginWithGoogle({ idToken: 'fake-id-token' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
      });
    });
  });

  describe('completeGoogleOnboarding edge cases', () => {
    it('rejects when the onboarding token is blank', async () => {
      const authService = createAuthService({});

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: '  ',
        } as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'GOOGLE_ONBOARDING_TOKEN_INVALID',
        }),
      });
    });

    it('rejects when the onboarding user no longer exists', async () => {
      const usersService = { findOne: jest.fn().mockResolvedValue(null) };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken('missing-user'),
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

    it('rejects onboarding when the birth date is missing', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'DONOR',
          cpf: '11122233344',
          birthDate: '',
          phone: '61999990000',
        }),
      ).rejects.toThrow('Birth date is required');
    });

    it('rejects onboarding when the phone is missing', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'DONOR',
          cpf: '11122233344',
          birthDate: '1998-02-09',
          phone: '',
        }),
      ).rejects.toThrow('Phone is required');
    });

    it('rejects a weak optional password during onboarding', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'DONOR',
          cpf: '11122233344',
          birthDate: '1998-02-09',
          phone: '61999990000',
          password: 'weak',
        }),
      ).rejects.toThrow('Password must have at least 8 characters');
    });

    it('rejects institution onboarding when the CNPJ is missing', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'owner@example.com',
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'owner@example.com',
          cpf: '11122233344',
          phone: '61999990000',
        }),
      };
      const authService = createAuthService({ usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'INSTITUTION',
          cpf: '11122233344',
          birthDate: '1998-02-09',
          phone: '61999990000',
        }),
      ).rejects.toThrow('Institution CNPJ is required');
    });

    it('rejects institution onboarding when the CNPJ is already registered', async () => {
      const userId = new Types.ObjectId();
      const usersService = {
        findOne: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'owner@example.com',
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({
          _id: userId,
          email: 'owner@example.com',
          cpf: '11122233344',
          phone: '61999990000',
        }),
      };
      const institutionModel = {
        findOne: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ _id: new Types.ObjectId() }),
        }),
      };
      const authService = createAuthService({ institutionModel, usersService });

      await expect(
        authService.completeGoogleOnboarding({
          onboardingToken: createGoogleOnboardingToken(userId.toString()),
          accountType: 'INSTITUTION',
          cpf: '11122233344',
          birthDate: '1998-02-09',
          phone: '61999990000',
          institutionCnpj: '12345678000199',
        }),
      ).rejects.toThrow('Institution CNPJ already registered');
    });
  });

  describe('onModuleInit', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('skips seeding dev users in production', async () => {
      process.env.NODE_ENV = 'production';
      const usersService = { upsertDevUser: jest.fn() };
      const authService = createAuthService({ usersService });

      await authService.onModuleInit();

      expect(usersService.upsertDevUser).not.toHaveBeenCalled();
    });

    it('seeds dev login users outside production', async () => {
      process.env.NODE_ENV = 'test';
      const adminId = new Types.ObjectId();
      const usersService = {
        upsertDevUser: jest
          .fn()
          .mockImplementationOnce(() =>
            Promise.resolve({ _id: new Types.ObjectId() }),
          )
          .mockImplementationOnce(() =>
            Promise.resolve({ _id: new Types.ObjectId() }),
          )
          .mockImplementationOnce(() =>
            Promise.resolve({ _id: adminId }),
          ),
      };
      const institutionModel = {
        findOneAndUpdate: jest
          .fn()
          .mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          }),
      };
      const institutionStaffMembershipModel = {
        findOneAndUpdate: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      };
      const authService = createAuthService({
        institutionModel,
        institutionStaffMembershipModel,
        usersService,
      });

      await authService.onModuleInit();

      expect(usersService.upsertDevUser).toHaveBeenCalledTimes(3);
      expect(institutionModel.findOneAndUpdate).toHaveBeenCalled();
      expect(institutionStaffMembershipModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });
});
