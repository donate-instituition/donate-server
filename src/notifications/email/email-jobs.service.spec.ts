import { EmailJobsService } from './email-jobs.service';

describe('EmailJobsService', () => {
  const appSettingsService = {
    getString: jest
      .fn()
      .mockImplementation((_, fallback) => Promise.resolve(fallback)),
  };

  it('publishes account created email jobs', async () => {
    const rabbitMqPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmailJobsService(
      rabbitMqPublisher as never,
      appSettingsService as never,
    );

    await service.sendAccountCreatedEmail({
      accountStatus: 'active',
      name: 'Ana',
      to: 'ana@example.com',
      userId: 'user-1',
    });

    expect(rabbitMqPublisher.publish).toHaveBeenCalledWith(
      'email.send',
      expect.objectContaining({
        idempotencyKey: 'email:account-created:user-1',
        payload: expect.objectContaining({
          html: expect.stringContaining('EloDoar'),
          subject: 'Ative sua conta no Elodoar',
          to: 'ana@example.com',
        }),
        type: 'email.send',
      }),
    );
  });

  it('publishes password reset code email jobs', async () => {
    const rabbitMqPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmailJobsService(
      rabbitMqPublisher as never,
      appSettingsService as never,
    );

    await service.sendPasswordResetCodeEmail({
      code: '123456',
      name: 'Ana',
      to: 'ana@example.com',
      userId: 'user-1',
    });

    expect(rabbitMqPublisher.publish).toHaveBeenCalledWith(
      'email.send',
      expect.objectContaining({
        idempotencyKey: 'email:password-reset-code:user-1:latest',
        payload: expect.objectContaining({
          html: expect.stringContaining('123456'),
          subject: 'Código para recuperar sua senha no Elodoar',
          text: expect.stringContaining('123456'),
          to: 'ana@example.com',
        }),
        type: 'email.send',
      }),
    );
  });

  it('publishes temporary password email jobs', async () => {
    const rabbitMqPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmailJobsService(
      rabbitMqPublisher as never,
      appSettingsService as never,
    );

    await service.sendTemporaryPasswordEmail({
      name: 'Ana',
      temporaryPassword: 'Elo-abc123',
      to: 'ana@example.com',
      userId: 'user-1',
    });

    expect(rabbitMqPublisher.publish).toHaveBeenCalledWith(
      'email.send',
      expect.objectContaining({
        idempotencyKey: 'email:temporary-password:user-1:latest',
        payload: expect.objectContaining({
          html: expect.stringContaining('Elo-abc123'),
          subject: 'Sua senha temporária do Elodoar',
          text: expect.stringContaining('Elo-abc123'),
          to: 'ana@example.com',
        }),
        type: 'email.send',
      }),
    );
  });
});
