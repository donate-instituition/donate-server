import {
  createAccountActivationToken,
  createAccountActivationUrl,
  verifyAccountActivationToken,
} from './account-activation';

describe('account activation tokens', () => {
  it('signs and verifies activation tokens with version', () => {
    const token = createAccountActivationToken('user-1', 'version-1');

    expect(verifyAccountActivationToken(token)).toEqual(
      expect.objectContaining({
        purpose: 'activate-account',
        sub: 'user-1',
        version: 'version-1',
      }),
    );
  });

  it('builds activation URLs with token query parameter', () => {
    const url = createAccountActivationUrl('user-1', 'version-1');

    expect(url).toContain('/auth/activate-account?token=');
    expect(url.split('token=')[1]).toBeTruthy();
  });
});
