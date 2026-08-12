import { AuthController } from './auth.controller';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from '../domains/users/models';

describe('AuthController', () => {
  function createController(overrides: Record<string, jest.Mock> = {}) {
    const authService = {
      login: jest.fn().mockResolvedValue({ accessToken: 'access-token' }),
      register: jest.fn().mockResolvedValue({ status: 'pending-verification' }),
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-access-token' }),
      loginWithGoogle: jest.fn().mockResolvedValue({ status: 'needs-onboarding' }),
      completeGoogleOnboarding: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access-token' }),
      activateAccount: jest.fn().mockResolvedValue({
        email: 'donor@example.com',
        message: 'Conta ativada com sucesso.',
        status: 'active',
      }),
      resendActivationEmail: jest
        .fn()
        .mockResolvedValue({ message: 'ok' }),
      forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      confirmForgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      logout: jest.fn().mockResolvedValue({ message: 'Logged out successfully' }),
      updateMySettings: jest.fn().mockResolvedValue({ id: 'user-1' }),
      changePassword: jest.fn().mockResolvedValue({ accessToken: 'access-token' }),
      ...overrides,
    };

    return {
      authService,
      controller: new AuthController(authService as never),
    };
  }

  function authenticatedUser(): AuthenticatedUser {
    return {
      sub: 'user-1',
      email: 'donor@example.com',
      roles: [UserRole.DONOR],
      type: UserType.PERSON,
      status: UserStatus.ACTIVE,
    };
  }

  it('delegates login to the auth service', async () => {
    const { authService, controller } = createController();
    const loginDto = { email: 'donor@example.com', password: 'secret123' };

    const response = await controller.login(loginDto);

    expect(authService.login).toHaveBeenCalledWith(loginDto);
    expect(response).toEqual({ accessToken: 'access-token' });
  });

  it('delegates register to the auth service', async () => {
    const { authService, controller } = createController();
    const registerDto = {
      name: 'Donor Example',
      email: 'donor@example.com',
      password: 'Secret123',
      cpf: '11122233344',
      birthDate: '1998-02-09',
      phone: '61999990000',
    };

    const response = await controller.register(registerDto);

    expect(authService.register).toHaveBeenCalledWith(registerDto);
    expect(response).toEqual({ status: 'pending-verification' });
  });

  it('delegates refresh using the token from the request body', async () => {
    const { authService, controller } = createController();

    const response = await controller.refresh({ refreshToken: 'refresh-tok' });

    expect(authService.refresh).toHaveBeenCalledWith('refresh-tok');
    expect(response).toEqual({ accessToken: 'new-access-token' });
  });

  it('delegates google login to the auth service', async () => {
    const { authService, controller } = createController();
    const googleLoginDto = { idToken: 'google-id-token' };

    const response = await controller.loginWithGoogle(googleLoginDto);

    expect(authService.loginWithGoogle).toHaveBeenCalledWith(googleLoginDto);
    expect(response).toEqual({ status: 'needs-onboarding' });
  });

  it('delegates google onboarding completion to the auth service', async () => {
    const { authService, controller } = createController();
    const onboardingDto = {
      onboardingToken: 'onboarding-tok',
      accountType: 'DONOR' as const,
      cpf: '11122233344',
      birthDate: '1998-02-09',
      phone: '61999990000',
    };

    const response = await controller.completeGoogleOnboarding(onboardingDto);

    expect(authService.completeGoogleOnboarding).toHaveBeenCalledWith(
      onboardingDto,
    );
    expect(response).toEqual({ accessToken: 'access-token' });
  });

  it('delegates account activation to the auth service', async () => {
    const { authService, controller } = createController();

    const response = await controller.activateAccount({ token: 'tok-1' });

    expect(authService.activateAccount).toHaveBeenCalledWith({
      token: 'tok-1',
    });
    expect(response.status).toBe('active');
  });

  it('delegates resend activation email to the auth service', async () => {
    const { authService, controller } = createController();

    await controller.resendActivationEmail({ email: 'donor@example.com' });

    expect(authService.resendActivationEmail).toHaveBeenCalledWith({
      email: 'donor@example.com',
    });
  });

  it('renders an HTML confirmation page with the escaped email on activation via link', async () => {
    const { authService, controller } = createController({
      activateAccount: jest.fn().mockResolvedValue({
        email: `<script>alert('x')</script>&"'@example.com`,
        message: 'Conta ativada com sucesso.',
        status: 'active',
      }),
    });

    const html = await controller.activateAccountFromEmail('tok-1');

    expect(authService.activateAccount).toHaveBeenCalledWith({
      token: 'tok-1',
    });
    expect(html).toContain('Conta ativada');
    expect(html).toContain(
      '&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;&amp;&quot;&#039;@example.com',
    );
    expect(html).not.toContain('<script>alert');
  });

  it('delegates forgot password to the auth service', async () => {
    const { authService, controller } = createController();

    await controller.forgotPassword({ email: 'donor@example.com' });

    expect(authService.forgotPassword).toHaveBeenCalledWith({
      email: 'donor@example.com',
    });
  });

  it('delegates forgot password confirmation to the auth service', async () => {
    const { authService, controller } = createController();

    await controller.confirmForgotPassword({
      email: 'donor@example.com',
      code: '123456',
    });

    expect(authService.confirmForgotPassword).toHaveBeenCalledWith({
      email: 'donor@example.com',
      code: '123456',
    });
  });

  it('delegates logout with the refresh token and current user sub', async () => {
    const { authService, controller } = createController();
    const user = authenticatedUser();

    await controller.logout({ refreshToken: 'refresh-tok' }, user);

    expect(authService.logout).toHaveBeenCalledWith('refresh-tok', user.sub);
  });

  it('delegates logout gracefully when no current user is present', async () => {
    const { authService, controller } = createController();

    await controller.logout({}, undefined);

    expect(authService.logout).toHaveBeenCalledWith(undefined, undefined);
  });

  it('returns the current user as-is from me', () => {
    const { controller } = createController();
    const user = authenticatedUser();

    expect(controller.me(user)).toBe(user);
  });

  it('returns undefined from me when unauthenticated', () => {
    const { controller } = createController();

    expect(controller.me(undefined)).toBeUndefined();
  });

  it('delegates settings updates to the auth service', async () => {
    const { authService, controller } = createController();
    const user = authenticatedUser();
    const body = { preferredRole: UserRole.DONOR };

    await controller.updateMySettings(body, user);

    expect(authService.updateMySettings).toHaveBeenCalledWith(user, body);
  });

  it('delegates password changes to the auth service', async () => {
    const { authService, controller } = createController();
    const user = authenticatedUser();
    const body = { currentPassword: 'old-pass', newPassword: 'New12345' };

    await controller.changePassword(body, user);

    expect(authService.changePassword).toHaveBeenCalledWith(user, body);
  });
});
