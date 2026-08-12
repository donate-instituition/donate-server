import { Types } from 'mongoose';

import { env } from '../../config/env';
import { PaymentGateway, PaymentMethod, PaymentStatus } from './models';
import { PaymentsService } from './payments.service';
import { StripeWebhookEventStatus } from './schemas/stripe-webhook-event.schema';

const mockStripeCustomersCreate = jest.fn();
const mockStripePricesCreate = jest.fn();
const mockStripeSubscriptionsCreate = jest.fn();
const mockStripeSubscriptionsCancel = jest.fn();
const mockStripePaymentIntentsCreate = jest.fn();
const mockStripeConstructEvent = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    customers: { create: mockStripeCustomersCreate },
    prices: { create: mockStripePricesCreate },
    subscriptions: {
      create: mockStripeSubscriptionsCreate,
      cancel: mockStripeSubscriptionsCancel,
    },
    paymentIntents: { create: mockStripePaymentIntentsCreate },
    webhooks: { constructEvent: mockStripeConstructEvent },
  })),
);

describe('PaymentsService', () => {
  const campaignId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const institutionId = new Types.ObjectId('507f1f77bcf86cd799439012');
  const validStripeConnectAccountId = 'acct_1ABC234567xyz';

  const originalEnv = {
    stripeSecretKey: env.stripeSecretKey,
    stripeWebhookSecret: env.stripeWebhookSecret,
    stripeCurrency: env.stripeCurrency,
    stripeServiceFeeBps: env.stripeServiceFeeBps,
  };

  beforeEach(() => {
    env.stripeSecretKey = 'sk_test_123';
    env.stripeWebhookSecret = '';
    env.stripeCurrency = 'brl';
    env.stripeServiceFeeBps = 0;
    jest.clearAllMocks();
  });

  afterEach(() => {
    env.stripeSecretKey = originalEnv.stripeSecretKey;
    env.stripeWebhookSecret = originalEnv.stripeWebhookSecret;
    env.stripeCurrency = originalEnv.stripeCurrency;
    env.stripeServiceFeeBps = originalEnv.stripeServiceFeeBps;
  });

  function createModels() {
    const paymentModel = {
      create: jest.fn((data: any) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...data }),
      ),
      find: jest.fn().mockReturnValue({
        sort: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      }),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findByIdAndDelete: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    const stripeWebhookEventModel = {
      updateOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    const donationModel = {
      create: jest.fn((data: any) =>
        Promise.resolve({
          _id: new Types.ObjectId(),
          ...data,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    const campaignModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: campaignId,
            institutionId,
            title: 'Campanha Teste',
          }),
        }),
      }),
    };

    const institutionModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: institutionId,
            displayName: 'Instituição Teste',
            legalName: 'Instituição Teste Ltda',
            stripeConnectAccountId: validStripeConnectAccountId,
            acceptsRecurringDonations: true,
          }),
        }),
      }),
    };

    return {
      paymentModel,
      stripeWebhookEventModel,
      donationModel,
      campaignModel,
      institutionModel,
    };
  }

  function createService(overrides: Partial<ReturnType<typeof createModels>> = {}) {
    const models = { ...createModels(), ...overrides };
    const rabbitMqPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const appSettingsService = {
      getNumber: jest.fn().mockResolvedValue(0),
    };

    const service = new PaymentsService(
      models.paymentModel as any,
      models.stripeWebhookEventModel as any,
      models.donationModel as any,
      models.campaignModel as any,
      models.institutionModel as any,
      rabbitMqPublisher as any,
      appSettingsService as any,
    );

    return { service, ...models, rabbitMqPublisher, appSettingsService };
  }

  describe('basic CRUD', () => {
    it('creates a payment', async () => {
      const { service, paymentModel } = createService();

      const dto = {
        donationId: new Types.ObjectId(),
        donorUserId: new Types.ObjectId(),
        institutionId: new Types.ObjectId(),
        gateway: PaymentGateway.STRIPE,
        paymentMethod: PaymentMethod.PIX,
        amount: 1000,
        currency: 'BRL',
      } as any;

      await service.create(dto);

      expect(paymentModel.create).toHaveBeenCalledWith(dto);
    });

    it('finds all payments sorted by createdAt desc', async () => {
      const { service, paymentModel } = createService();

      const result = await service.findAll();

      expect(paymentModel.find).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('finds one payment by id', async () => {
      const { service, paymentModel } = createService();

      await service.findOne('pay-1');

      expect(paymentModel.findById).toHaveBeenCalledWith('pay-1');
    });

    it('updates a payment', async () => {
      const { service, paymentModel } = createService();

      await service.update('pay-1', { status: PaymentStatus.PAID } as any);

      expect(paymentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'pay-1',
        { status: PaymentStatus.PAID },
        { returnDocument: 'after' },
      );
    });

    it('removes a payment', async () => {
      const { service, paymentModel } = createService();

      await service.remove('pay-1');

      expect(paymentModel.findByIdAndDelete).toHaveBeenCalledWith('pay-1');
    });
  });

  describe('createStripePaymentIntent', () => {
    function baseDto(overrides: Record<string, unknown> = {}) {
      return {
        amountCents: 10000,
        campaignId: campaignId.toString(),
        ...overrides,
      } as any;
    }

    it('throws when campaignId is missing', async () => {
      const { service } = createService();

      await expect(
        service.createStripePaymentIntent({ amountCents: 100 } as any),
      ).rejects.toThrow('campaignId is required');
    });

    it('throws when amountCents is not greater than zero', async () => {
      const { service } = createService();

      await expect(
        service.createStripePaymentIntent(baseDto({ amountCents: 0 })),
      ).rejects.toThrow('amountCents must be greater than zero');
    });

    it('throws when campaignId is not a valid ObjectId', async () => {
      const { service } = createService();

      await expect(
        service.createStripePaymentIntent(baseDto({ campaignId: 'not-valid' })),
      ).rejects.toThrow('Invalid ObjectId');
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      const { service, campaignModel } = createService();
      campaignModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        /não encontrada/,
      );
    });

    it('throws NotFoundException when institution does not exist', async () => {
      const { service, institutionModel } = createService();
      institutionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        /não encontrada/,
      );
    });

    it('throws when institution has no Stripe connected account', async () => {
      const { service, institutionModel } = createService();
      institutionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: institutionId,
            displayName: 'Instituição Teste',
          }),
        }),
      });

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        'Institution does not have a Stripe connected account.',
      );
    });

    it('throws when Stripe connected account id is not a real test account', async () => {
      const { service, institutionModel } = createService();
      institutionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: institutionId,
            stripeConnectAccountId: 'not-an-account-id',
          }),
        }),
      });

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        /must be a real test acct_/,
      );
    });

    it('throws when Stripe connected account id is a placeholder', async () => {
      const { service, institutionModel } = createService();
      institutionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: institutionId,
            stripeConnectAccountId: 'acct_CONTATESTE1',
          }),
        }),
      });

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        /must be a real test acct_/,
      );
    });

    it('throws when donationKind is monthly but institution does not accept recurring donations', async () => {
      const { service, institutionModel } = createService();
      institutionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: institutionId,
            stripeConnectAccountId: validStripeConnectAccountId,
            acceptsRecurringDonations: false,
          }),
        }),
      });

      await expect(
        service.createStripePaymentIntent(baseDto({ donationKind: 'monthly' })),
      ).rejects.toThrow('Institution does not accept recurring donations.');
    });

    it('throws ServiceUnavailableException when Stripe is not configured', async () => {
      env.stripeSecretKey = '';
      const { service } = createService();

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        'Stripe is not configured.',
      );
    });

    it('throws ServiceUnavailableException when the service fee config is invalid', async () => {
      const { service, appSettingsService } = createService();
      appSettingsService.getNumber.mockResolvedValue(10_000);

      await expect(service.createStripePaymentIntent(baseDto())).rejects.toThrow(
        'Invalid Stripe service fee configuration.',
      );
    });

    it('creates a single one-off payment intent with the app contract', async () => {
      const { service, appSettingsService, paymentModel, donationModel } =
        createService();
      appSettingsService.getNumber.mockResolvedValue(500);
      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        client_secret: 'secret_xyz',
      });

      const result = await service.createStripePaymentIntent(
        baseDto({ receiptEmail: '  donor@example.com  ' }),
        undefined,
        'idem-key-1',
      );

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
          currency: 'brl',
          application_fee_amount: 500,
          receipt_email: 'donor@example.com',
          transfer_data: { destination: validStripeConnectAccountId },
        }),
        { idempotencyKey: 'payment-intent:idem-key-1' },
      );
      expect(donationModel.create).toHaveBeenCalled();
      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gateway: PaymentGateway.STRIPE,
          gatewayTransactionId: 'pi_test123',
          status: PaymentStatus.PAID,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          clientSecret: 'secret_xyz',
          donation: expect.objectContaining({
            campaignId: campaignId.toString(),
            campaignTitle: 'Campanha Teste',
            institutionName: 'Instituição Teste',
            amountCents: 10000,
          }),
          payment: expect.objectContaining({
            paymentIntentId: 'pi_test123',
            serviceFeeAmount: 500,
            serviceFeeBps: 500,
            status: PaymentStatus.PAID,
            subscriptionId: undefined,
          }),
        }),
      );
    });

    it('creates a monthly subscription payment intent', async () => {
      const { service } = createService();
      mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_1' });
      mockStripePricesCreate.mockResolvedValue({ id: 'price_1' });
      mockStripeSubscriptionsCreate.mockResolvedValue({
        id: 'sub_1',
        latest_invoice: {
          payment_intent: {
            id: 'pi_sub1',
            status: 'requires_action',
            client_secret: 'secret_sub',
          },
        },
      });

      const result = await service.createStripePaymentIntent(
        baseDto({ donationKind: 'monthly' }),
      );

      expect(mockStripeCustomersCreate).toHaveBeenCalled();
      expect(mockStripePricesCreate).toHaveBeenCalled();
      expect(mockStripeSubscriptionsCreate).toHaveBeenCalled();
      expect(result.payment).toEqual(
        expect.objectContaining({
          subscriptionId: 'sub_1',
          paymentIntentId: 'pi_sub1',
        }),
      );
    });

    it('throws ServiceUnavailableException when Stripe does not return a payment intent for a subscription', async () => {
      const { service } = createService();
      mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_1' });
      mockStripePricesCreate.mockResolvedValue({ id: 'price_1' });
      mockStripeSubscriptionsCreate.mockResolvedValue({
        id: 'sub_1',
        latest_invoice: { payment_intent: 'pi_string_only' },
      });

      await expect(
        service.createStripePaymentIntent(baseDto({ donationKind: 'monthly' })),
      ).rejects.toThrow('Stripe did not return a payment intent.');
    });

    it('generates a donor ObjectId when donorUserId is a valid id', async () => {
      const { service, donationModel } = createService();
      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_1',
        status: 'requires_payment_method',
        client_secret: 'secret',
      });
      const donorUserId = new Types.ObjectId().toString();

      await service.createStripePaymentIntent(baseDto(), donorUserId);

      expect(donationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ donorUserId: expect.any(Types.ObjectId) }),
      );
    });
  });

  describe('confirmStripePaymentIntent', () => {
    it('throws NotFoundException when payment is not found', async () => {
      const { service } = createService();

      await expect(
        service.confirmStripePaymentIntent('pi_missing'),
      ).rejects.toThrow(/não encontrado/);
    });

    it('throws NotFoundException when donation is not found', async () => {
      const { service, paymentModel } = createService();
      paymentModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          donationId: new Types.ObjectId(),
          gatewayPayload: {},
          status: PaymentStatus.PENDING,
        }),
      });

      await expect(
        service.confirmStripePaymentIntent('pi_1'),
      ).rejects.toThrow(/não encontrada/);
    });

    it('returns the enriched donation and payment when both exist', async () => {
      const { service, paymentModel, donationModel } = createService();
      const donationId = new Types.ObjectId();
      paymentModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          donationId,
          gatewayPayload: {
            serviceFeeAmount: 500,
            serviceFeeBps: 500,
            subscriptionId: 'sub_1',
          },
          status: PaymentStatus.PAID,
        }),
      });
      donationModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: donationId,
          campaignId,
          institutionId,
          moneyDonation: { amount: 100 },
          status: 'PAID',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      });

      const result = await service.confirmStripePaymentIntent('pi_1');

      expect(result).toEqual(
        expect.objectContaining({
          donation: expect.objectContaining({ amountCents: 10000 }),
          payment: expect.objectContaining({
            paymentIntentId: 'pi_1',
            serviceFeeAmount: 500,
            serviceFeeBps: 500,
            subscriptionId: 'sub_1',
          }),
        }),
      );
    });
  });

  describe('cancelStripeSubscription', () => {
    it('throws BadRequestException when subscriptionId is missing', async () => {
      const { service } = createService();

      await expect(service.cancelStripeSubscription('')).rejects.toThrow(
        'subscriptionId is required',
      );
    });

    it('throws NotFoundException when the subscription payment is not found', async () => {
      const { service } = createService();

      await expect(
        service.cancelStripeSubscription('sub_missing'),
      ).rejects.toThrow(/não encontrada/);
    });

    it('throws BadRequestException when the subscription does not belong to the current user', async () => {
      const { service, paymentModel } = createService();
      const owningDonorId = new Types.ObjectId();
      paymentModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          donorUserId: owningDonorId,
          gatewayPayload: { subscriptionId: 'sub_1' },
          save: jest.fn(),
        }),
      });

      await expect(
        service.cancelStripeSubscription(
          'sub_1',
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow('Subscription does not belong to the current user.');
    });

    it('cancels the subscription and persists the updated payload', async () => {
      const { service, paymentModel } = createService();
      const donorUserId = new Types.ObjectId();
      const save = jest.fn().mockResolvedValue(undefined);
      const paymentDoc: any = {
        donorUserId,
        gatewayPayload: { subscriptionId: 'sub_1' },
        save,
      };
      paymentModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(paymentDoc),
      });
      mockStripeSubscriptionsCancel.mockResolvedValue({ status: 'canceled' });

      const result = await service.cancelStripeSubscription(
        'sub_1',
        donorUserId.toString(),
      );

      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith('sub_1');
      expect(save).toHaveBeenCalled();
      expect(paymentDoc.gatewayPayload).toEqual(
        expect.objectContaining({
          subscriptionId: 'sub_1',
          subscriptionStatus: 'canceled',
        }),
      );
      expect(result).toEqual({
        canceled: true,
        subscriptionId: 'sub_1',
        status: 'canceled',
      });
    });
  });

  describe('getStripeConfig', () => {
    it('returns currency and service fee configuration', async () => {
      const { service, appSettingsService } = createService();
      appSettingsService.getNumber.mockResolvedValue(250);

      const result = await service.getStripeConfig();

      expect(result).toEqual({ currency: 'BRL', serviceFeeBps: 250 });
    });
  });

  describe('enqueueStripeWebhookEvent', () => {
    const stripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      livemode: false,
    };

    it('throws ServiceUnavailableException when Stripe is not configured', async () => {
      env.stripeSecretKey = '';
      const { service } = createService();

      await expect(
        service.enqueueStripeWebhookEvent(undefined, undefined, {}),
      ).rejects.toThrow('Stripe is not configured.');
    });

    it('throws BadRequestException when signature/rawBody missing but a webhook secret is configured', async () => {
      env.stripeWebhookSecret = 'whsec_test';
      const { service } = createService();

      await expect(
        service.enqueueStripeWebhookEvent(undefined, undefined, {}),
      ).rejects.toThrow('Missing Stripe webhook signature.');
      expect(mockStripeConstructEvent).not.toHaveBeenCalled();
    });

    it('verifies the signature via Stripe when a webhook secret is configured', async () => {
      env.stripeWebhookSecret = 'whsec_test';
      const { service, stripeWebhookEventModel, rabbitMqPublisher } =
        createService();
      mockStripeConstructEvent.mockReturnValue(stripeEvent);
      const rawBody = Buffer.from('{}');

      const result = await service.enqueueStripeWebhookEvent(
        rawBody,
        'sig_1',
        {},
      );

      expect(mockStripeConstructEvent).toHaveBeenCalledWith(
        rawBody,
        'sig_1',
        'whsec_test',
      );
      expect(stripeWebhookEventModel.updateOne).toHaveBeenCalledWith(
        { eventId: 'evt_123' },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            eventId: 'evt_123',
            status: StripeWebhookEventStatus.QUEUED,
            type: 'payment_intent.succeeded',
          }),
        }),
        { upsert: true },
      );
      expect(rabbitMqPublisher.publish).toHaveBeenCalledWith(
        'stripe.webhook',
        expect.objectContaining({
          type: 'stripe.webhook',
          payload: { eventId: 'evt_123' },
        }),
      );
      expect(result).toEqual({ received: true, queued: true });
    });

    it('trusts the parsed body when no webhook secret is configured', async () => {
      env.stripeWebhookSecret = '';
      const { service } = createService();

      const result = await service.enqueueStripeWebhookEvent(
        undefined,
        undefined,
        stripeEvent,
      );

      expect(mockStripeConstructEvent).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, queued: true });
    });

    it('rejects a live event received while using a test API key', async () => {
      env.stripeSecretKey = 'sk_test_123';

      const { service } = createService();

      await expect(
        service.enqueueStripeWebhookEvent(undefined, undefined, {
          ...stripeEvent,
          livemode: true,
        }),
      ).rejects.toThrow('Live Stripe event received while using test API keys.');
    });

    it('rejects a test event received while using a live API key', async () => {
      env.stripeSecretKey = 'sk_live_123';

      const { service } = createService();

      await expect(
        service.enqueueStripeWebhookEvent(undefined, undefined, {
          ...stripeEvent,
          livemode: false,
        }),
      ).rejects.toThrow('Test Stripe event received while using live API keys.');
    });
  });
});
