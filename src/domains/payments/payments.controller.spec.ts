import {
  PaymentsController,
  StripeWebhookController,
} from './payments.controller';

function createPaymentsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    findAll: jest.fn().mockResolvedValue([{ id: 'pay-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    update: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    createStripePaymentIntent: jest
      .fn()
      .mockResolvedValue({ clientSecret: 'secret' }),
    confirmStripePaymentIntent: jest
      .fn()
      .mockResolvedValue({ payment: { status: 'PAID' } }),
    cancelStripeSubscription: jest
      .fn()
      .mockResolvedValue({ canceled: true }),
    getStripeConfig: jest
      .fn()
      .mockResolvedValue({ currency: 'BRL', serviceFeeBps: 0 }),
    enqueueStripeWebhookEvent: jest
      .fn()
      .mockResolvedValue({ received: true, queued: true }),
  };
}

describe('PaymentsController', () => {
  function createController() {
    const paymentsService = createPaymentsServiceMock();
    const controller = new PaymentsController(paymentsService as any);
    return { controller, paymentsService };
  }

  it('delegates create to the service', async () => {
    const { controller, paymentsService } = createController();
    const dto = { amount: 1000 } as any;

    const result = await controller.create(dto);

    expect(paymentsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'pay-1' });
  });

  it('delegates createStripePaymentIntent with user id and idempotency key', async () => {
    const { controller, paymentsService } = createController();
    const dto = { amountCents: 5000, campaignId: 'c-1' } as any;
    const user = { sub: 'user-1' } as any;

    const result = await controller.createStripePaymentIntent(
      dto,
      user,
      'idem-1',
    );

    expect(paymentsService.createStripePaymentIntent).toHaveBeenCalledWith(
      dto,
      'user-1',
      'idem-1',
    );
    expect(result).toEqual({ clientSecret: 'secret' });
  });

  it('delegates createStripePaymentIntent with an undefined user', async () => {
    const { controller, paymentsService } = createController();
    const dto = { amountCents: 5000, campaignId: 'c-1' } as any;

    await controller.createStripePaymentIntent(dto, undefined, undefined);

    expect(paymentsService.createStripePaymentIntent).toHaveBeenCalledWith(
      dto,
      undefined,
      undefined,
    );
  });

  it('delegates confirmStripePaymentIntent to the service', async () => {
    const { controller, paymentsService } = createController();

    const result = await controller.confirmStripePaymentIntent('pi_1');

    expect(paymentsService.confirmStripePaymentIntent).toHaveBeenCalledWith(
      'pi_1',
    );
    expect(result).toEqual({ payment: { status: 'PAID' } });
  });

  it('delegates cancelStripeSubscription with the current user id', async () => {
    const { controller, paymentsService } = createController();
    const user = { sub: 'user-1' } as any;

    const result = await controller.cancelStripeSubscription('sub_1', user);

    expect(paymentsService.cancelStripeSubscription).toHaveBeenCalledWith(
      'sub_1',
      'user-1',
    );
    expect(result).toEqual({ canceled: true });
  });

  it('delegates getStripeConfig to the service', async () => {
    const { controller, paymentsService } = createController();

    const result = await controller.getStripeConfig();

    expect(paymentsService.getStripeConfig).toHaveBeenCalled();
    expect(result).toEqual({ currency: 'BRL', serviceFeeBps: 0 });
  });

  it('handles the Stripe webhook using rawBody, signature and parsed body', async () => {
    const { controller, paymentsService } = createController();
    const rawBody = Buffer.from('{}');
    const request = { rawBody, body: { id: 'evt_1' } } as any;

    const result = await controller.handleStripeWebhook(request, 'sig_1');

    expect(paymentsService.enqueueStripeWebhookEvent).toHaveBeenCalledWith(
      rawBody,
      'sig_1',
      { id: 'evt_1' },
    );
    expect(result).toEqual({ received: true, queued: true });
  });

  it('handles the Stripe webhook without a signature header', async () => {
    const { controller, paymentsService } = createController();
    const request = { rawBody: undefined, body: { id: 'evt_1' } } as any;

    await controller.handleStripeWebhook(request, undefined);

    expect(paymentsService.enqueueStripeWebhookEvent).toHaveBeenCalledWith(
      undefined,
      undefined,
      { id: 'evt_1' },
    );
  });

  it('delegates findAll to the service', async () => {
    const { controller, paymentsService } = createController();

    const result = await controller.findAll();

    expect(paymentsService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'pay-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, paymentsService } = createController();

    const result = await controller.findOne('pay-1');

    expect(paymentsService.findOne).toHaveBeenCalledWith('pay-1');
    expect(result).toEqual({ id: 'pay-1' });
  });

  it('delegates update to the service', async () => {
    const { controller, paymentsService } = createController();
    const dto = { status: 'PAID' } as any;

    const result = await controller.update('pay-1', dto);

    expect(paymentsService.update).toHaveBeenCalledWith('pay-1', dto);
    expect(result).toEqual({ id: 'pay-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, paymentsService } = createController();

    const result = await controller.remove('pay-1');

    expect(paymentsService.remove).toHaveBeenCalledWith('pay-1');
    expect(result).toEqual({ id: 'pay-1' });
  });
});

describe('StripeWebhookController', () => {
  it('handles the Stripe webhook alias route the same way as /payments/stripe/webhook', async () => {
    const paymentsService = createPaymentsServiceMock();
    const controller = new StripeWebhookController(paymentsService as any);
    const rawBody = Buffer.from('{}');
    const request = { rawBody, body: { id: 'evt_1' } } as any;

    const result = await controller.handleStripeWebhookAlias(
      request,
      'sig_1',
    );

    expect(paymentsService.enqueueStripeWebhookEvent).toHaveBeenCalledWith(
      rawBody,
      'sig_1',
      { id: 'evt_1' },
    );
    expect(result).toEqual({ received: true, queued: true });
  });
});
