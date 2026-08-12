import { AccountActivationLandingController } from './account-activation-landing.controller';

describe('AccountActivationLandingController', () => {
  function createController(overrides: Record<string, jest.Mock> = {}) {
    const authService = {
      activateAccount: jest.fn().mockResolvedValue({
        email: 'donor@example.com',
        message: 'Conta ativada com sucesso.',
        status: 'active',
      }),
      ...overrides,
    };

    return {
      authService,
      controller: new AccountActivationLandingController(authService as never),
    };
  }

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
});
