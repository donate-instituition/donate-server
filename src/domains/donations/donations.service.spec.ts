import { DonationsService } from './donations.service';

describe('DonationsService', () => {
  const donationModel = {
    countDocuments: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    create: jest.fn().mockResolvedValue({
      _id: 'don-1',
      campaignId: '1',
      institutionId: 'inst-1',
      moneyDonation: { amount: 50, currency: 'BRL' },
      status: 'PAID',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      }),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }),
  };

  const campaignModel = {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          institutionId: 'inst-1',
          title: 'Campanha Teste',
        }),
      }),
    }),
    findByIdAndUpdate: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'campaign-1' }),
      }),
    }),
  };

  const institutionModel = {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ displayName: 'Instituição Teste' }),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'inst-1' }),
      }),
    }),
  };

  const institutionStaffMembershipModel = {};

  const paymentModel = {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'pay-1',
            gatewayPayload: {
              donationKind: 'single',
              serviceFeeAmount: 250,
              serviceFeeBps: 500,
            },
            status: 'PAID',
          }),
        }),
      }),
    }),
  };

  const taxReceiptModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'receipt-1',
          documentUrl: '/storage/receipts/receipt.pdf',
          receiptNumber: 'ED-2026-00000001',
        }),
      }),
    }),
  };

  it('returns a donation list with the app contract', async () => {
    const service = new DonationsService(
      donationModel as any,
      campaignModel as any,
      institutionModel as any,
      institutionStaffMembershipModel as any,
      paymentModel as any,
      taxReceiptModel as any,
    );

    const donations = await service.findAll();

    expect(Array.isArray(donations)).toBe(true);
  });

  it('creates a donation payload for the app', async () => {
    const service = new DonationsService(
      donationModel as any,
      campaignModel as any,
      institutionModel as any,
      institutionStaffMembershipModel as any,
      paymentModel as any,
      taxReceiptModel as any,
    );

    const response = await service.create({
      campaignId: '1',
      amountCents: 5000,
    });

    expect(response).toEqual(
      expect.objectContaining({
        donation: expect.objectContaining({
          campaignId: '1',
          amountCents: 5000,
          serviceFeeAmount: 250,
          netAmountCents: 4750,
        }),
      }),
    );
  });
});
