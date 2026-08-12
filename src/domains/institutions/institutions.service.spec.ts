import { env } from '../../config/env';
import { CampaignStatus } from '../campaigns/models';
import { InstitutionDonationType, InstitutionStatus } from './models';
import { InstitutionsService } from './institutions.service';

const mockStripeAccountsRetrieve = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    accounts: {
      retrieve: mockStripeAccountsRetrieve,
    },
  }));
});

const INSTITUTION_ID = '507f1f77bcf86cd799439011';
const OTHER_INSTITUTION_ID = '507f1f77bcf86cd799439099';
const USER_ID = '507f1f77bcf86cd799439022';

function createRedisServiceMock() {
  return {
    cacheAside: jest.fn((_key: string, _ttl: number, loader: () => unknown) =>
      loader(),
    ),
    del: jest.fn().mockResolvedValue(0),
  };
}

function createInstitutionModelMock() {
  return {
    countDocuments: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    create: jest.fn().mockResolvedValue({}),
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
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      exec: jest.fn().mockResolvedValue(null),
    }),
    findByIdAndDelete: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    }),
  };
}

function createCampaignModelMock() {
  return {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      }),
    }),
  };
}

function createAuditLogModelMock() {
  return {
    create: jest.fn().mockResolvedValue({}),
  };
}

function createMembershipModelMock(exists: boolean) {
  return {
    exists: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(exists) }),
  };
}

function baseInstitutionDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: INSTITUTION_ID,
    legalName: 'Instituto Legal',
    displayName: 'Instituto Legal',
    cnpj: '00000000000100',
    email: 'contato@instituto.org.br',
    phone: '11999999999',
    website: 'https://instituto.org.br',
    description: 'Descrição da instituição.',
    status: InstitutionStatus.ACTIVE,
    verification: { isVerified: true },
    address: {
      city: 'São Paulo',
      state: 'SP',
      location: { type: 'Point', coordinates: [-46.6333, -23.5505] },
    },
    acceptedDonationTypes: [InstitutionDonationType.MONEY],
    acceptsRecurringDonations: true,
    taxReceiptEnabled: true,
    stats: {
      followersCount: 3,
      campaignsCount: 2,
      receivedDonationsCount: 5,
      receivedAmount: 10000,
      postsCount: 1,
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('InstitutionsService', () => {
  beforeEach(() => {
    env.stripeSecretKey = 'sk_test_123';
    mockStripeAccountsRetrieve.mockReset();
  });

  function createService({
    institutionModel = createInstitutionModelMock(),
    campaignModel = createCampaignModelMock(),
    auditLogModel = createAuditLogModelMock(),
    membershipModel = createMembershipModelMock(true),
    redisService = createRedisServiceMock(),
  }: {
    institutionModel?: ReturnType<typeof createInstitutionModelMock>;
    campaignModel?: ReturnType<typeof createCampaignModelMock>;
    auditLogModel?: ReturnType<typeof createAuditLogModelMock>;
    membershipModel?: ReturnType<typeof createMembershipModelMock>;
    redisService?: ReturnType<typeof createRedisServiceMock>;
  } = {}) {
    const service = new InstitutionsService(
      institutionModel as any,
      campaignModel as any,
      auditLogModel as any,
      membershipModel as any,
      redisService as any,
    );

    return { service, institutionModel, campaignModel, auditLogModel, membershipModel, redisService };
  }

  describe('create', () => {
    it('seeds default institutions when the collection is empty', async () => {
      const institutionModel = createInstitutionModelMock();
      institutionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      const { service } = createService({ institutionModel });

      const dto = { legalName: 'Nova', displayName: 'Nova' } as any;
      await service.create(dto);

      expect(institutionModel.create).toHaveBeenCalledTimes(2);
      expect(Array.isArray(institutionModel.create.mock.calls[0][0])).toBe(
        true,
      );
      expect(institutionModel.create.mock.calls[0][0]).toHaveLength(2);
      expect(institutionModel.create.mock.calls[1][0]).toBe(dto);
    });

    it('skips seeding when institutions already exist', async () => {
      const institutionModel = createInstitutionModelMock();
      institutionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      const { service } = createService({ institutionModel });

      const dto = { legalName: 'Nova', displayName: 'Nova' } as any;
      await service.create(dto);

      expect(institutionModel.create).toHaveBeenCalledTimes(1);
      expect(institutionModel.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('returns a plain array when pagination is not requested', async () => {
      const institutionModel = createInstitutionModelMock();
      const leanExec = jest
        .fn()
        .mockResolvedValue([baseInstitutionDoc(), baseInstitutionDoc({ _id: OTHER_INSTITUTION_ID })]);
      institutionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({ exec: leanExec }),
            }),
          }),
        }),
      });
      const { service } = createService({ institutionModel });

      const institutions = await service.findAll();

      expect(Array.isArray(institutions)).toBe(true);
      expect(institutions).toHaveLength(2);
      expect(institutions[0]).toEqual(
        expect.objectContaining({
          id: INSTITUTION_ID,
          name: 'Instituto Legal',
          city: 'São Paulo',
          state: 'SP',
          verified: true,
        }),
      );
      expect(institutionModel.countDocuments).toHaveBeenCalledTimes(1);
    });

    it('returns a paginated envelope when pagination query params are present', async () => {
      const institutionModel = createInstitutionModelMock();
      institutionModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(1) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(7) });
      const leanExec = jest.fn().mockResolvedValue([baseInstitutionDoc()]);
      institutionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({ exec: leanExec }),
            }),
          }),
        }),
      });
      const { service } = createService({ institutionModel });

      const result = await service.findAll({ page: '2', limit: '10' });

      expect(result).toEqual(
        expect.objectContaining({
          items: expect.any(Array),
          meta: expect.objectContaining({ total: 7, page: 2, limit: 10 }),
        }),
      );
    });
  });

  describe('findPending', () => {
    it('maps pending institutions to the admin shape', async () => {
      const institutionModel = createInstitutionModelMock();
      const leanExec = jest
        .fn()
        .mockResolvedValue([
          baseInstitutionDoc({ status: InstitutionStatus.PENDING_APPROVAL }),
        ]);
      institutionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({ exec: leanExec }),
            }),
          }),
        }),
      });
      const { service } = createService({ institutionModel });

      const pending = await service.findPending();

      expect(pending).toHaveLength(1);
      expect(pending[0]).toEqual(
        expect.objectContaining({
          cnpj: '00000000000100',
          email: 'contato@instituto.org.br',
          status: InstitutionStatus.PENDING_APPROVAL,
        }),
      );
    });
  });

  describe('findAllForAdmin', () => {
    it('maps all institutions to the admin shape with pagination', async () => {
      const institutionModel = createInstitutionModelMock();
      institutionModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(1) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(1) });
      const leanExec = jest.fn().mockResolvedValue([baseInstitutionDoc()]);
      institutionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({ exec: leanExec }),
            }),
          }),
        }),
      });
      const { service } = createService({ institutionModel });

      const result = await service.findAllForAdmin({ page: '1' });

      expect(result.items[0]).toEqual(
        expect.objectContaining({ cnpj: '00000000000100' }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the institution does not exist', async () => {
      const institutionModel = createInstitutionModelMock();
      const { service } = createService({ institutionModel });

      await expect(service.findOne(INSTITUTION_ID)).rejects.toThrow(
        `Instituição ${INSTITUTION_ID} não encontrada.`,
      );
    });

    it('returns a full profile with campaigns and merged stripe state', async () => {
      const institutionModel = createInstitutionModelMock();
      const institutionDoc = baseInstitutionDoc({
        stripeConnect: {
          accountId: 'acct_123',
          chargesEnabled: true,
          detailsSubmitted: true,
          ready: true,
          payoutsEnabled: true,
          exists: true,
          livemode: false,
          requirementsCurrentlyDue: [],
          verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        stripeConnectAccountId: 'acct_123',
      });
      institutionModel.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(institutionDoc) }),
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(institutionDoc),
          }),
        }),
      });

      const campaignModel = createCampaignModelMock();
      const activeExpiredCampaign = {
        _id: 'c-1',
        title: 'Campanha Expirada',
        institutionId: INSTITUTION_ID,
        status: CampaignStatus.PUBLISHED,
        endAt: new Date('2020-01-01T00:00:00.000Z'),
        goal: { moneyTarget: 100 },
        progress: { moneyRaised: 50 },
        acceptedItems: [{ category: 'FOOD' }],
      };
      const activeOngoingCampaign = {
        _id: 'c-2',
        title: 'Campanha Ativa',
        institutionId: INSTITUTION_ID,
        status: CampaignStatus.PUBLISHED,
        endAt: new Date('2099-01-01T00:00:00.000Z'),
        goal: { moneyTarget: 0 },
        progress: { moneyRaised: 0 },
        acceptedItems: [],
      };
      const draftCampaign = {
        _id: 'c-3',
        title: 'Campanha Rascunho',
        institutionId: INSTITUTION_ID,
        status: CampaignStatus.DRAFT,
        goal: { moneyTarget: 10 },
        progress: { moneyRaised: 0 },
      };
      campaignModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([
                activeExpiredCampaign,
                activeOngoingCampaign,
                draftCampaign,
              ]),
          }),
        }),
      });

      const { service } = createService({ institutionModel, campaignModel });

      const result = await service.findOne(INSTITUTION_ID);

      expect(result.activeCampaigns).toBe(2);
      expect(result.campaigns).toHaveLength(3);
      expect(result.campaigns[0]).toEqual(
        expect.objectContaining({
          id: 'c-1',
          title: 'Campanha Expirada',
          active: false,
          goalCents: 10000,
          raisedCents: 5000,
          progress: 50,
          category: 'Alimentação',
        }),
      );
      expect(result.campaigns[1]).toEqual(
        expect.objectContaining({ id: 'c-2', active: true, progress: 0 }),
      );
      expect(result.stripeConnect).toEqual(
        expect.objectContaining({ ready: true, status: 'ready', accountId: 'acct_123' }),
      );
      expect(result.stripeConnectAccountId).toBe('acct_123');
      expect(result.foundedYear).toBe(2010);
    });

    it('reports missing stripe status when no data exists', async () => {
      const institutionModel = createInstitutionModelMock();
      const institutionDoc = baseInstitutionDoc();
      institutionModel.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(institutionDoc) }),
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });
      const { service } = createService({ institutionModel });

      const result = await service.findOne(INSTITUTION_ID);

      expect(result.stripeConnect).toEqual({ ready: false, status: 'missing' });
      expect(result.stripeConnectAccountId).toBeUndefined();
    });
  });

  describe('verifyStripeConnectAccount', () => {
    const dto = { stripeConnectAccountId: 'acct_valid123' };

    it('rejects when the user id is missing or invalid', async () => {
      const { service } = createService();

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, undefined),
      ).rejects.toThrow('Usuário autenticado inválido.');
    });

    it('rejects when the institution id is not a valid ObjectId', async () => {
      const { service } = createService();

      await expect(
        service.verifyStripeConnectAccount('not-an-id', dto, USER_ID),
      ).rejects.toThrow('Instituição inválida.');
    });

    it('rejects when the user has no active membership', async () => {
      const membershipModel = createMembershipModelMock(false);
      const { service } = createService({ membershipModel });

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, USER_ID),
      ).rejects.toThrow('Usuário não possui vínculo ativo com esta instituição.');
    });

    it('rejects an invalid stripe account id format', async () => {
      const { service } = createService();

      await expect(
        service.verifyStripeConnectAccount(
          INSTITUTION_ID,
          { stripeConnectAccountId: 'not-valid' },
          USER_ID,
        ),
      ).rejects.toThrow(
        'Informe um ID real de conta conectada Stripe no formato acct_...',
      );
    });

    it.each(['acct_teste123', 'acct_test123', 'acct_example123', 'acct_seu_id123'])(
      'rejects placeholder-looking account ids (%s)',
      async (accountId) => {
        const { service } = createService();

        await expect(
          service.verifyStripeConnectAccount(
            INSTITUTION_ID,
            { stripeConnectAccountId: accountId },
            USER_ID,
          ),
        ).rejects.toThrow(
          'Informe um ID real de conta conectada Stripe no formato acct_...',
        );
      },
    );

    it('rejects when the account is already linked to another institution', async () => {
      const institutionModel = createInstitutionModelMock();
      institutionModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue({ _id: OTHER_INSTITUTION_ID, name: 'Outra' }),
          }),
        }),
      });
      const { service } = createService({ institutionModel });

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, USER_ID),
      ).rejects.toThrow('Essa conta Stripe já está vinculada a outra instituição.');
    });

    it('throws ServiceUnavailableException when Stripe is not configured', async () => {
      env.stripeSecretKey = '';
      const { service } = createService();

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, USER_ID),
      ).rejects.toThrow('Stripe não está configurada.');
    });

    it('wraps stripe retrieval errors in a BadRequestException', async () => {
      mockStripeAccountsRetrieve.mockRejectedValue(new Error('network down'));
      const { service } = createService();

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, USER_ID),
      ).rejects.toThrow('Não foi possível validar essa conta Stripe');
    });

    it('rejects a deleted stripe account', async () => {
      mockStripeAccountsRetrieve.mockResolvedValue({
        id: 'acct_valid123',
        deleted: true,
      });
      const { service } = createService();

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, USER_ID),
      ).rejects.toThrow('A conta Stripe informada foi removida.');
    });

    it('throws NotFoundException when the institution disappears during update', async () => {
      mockStripeAccountsRetrieve.mockResolvedValue({
        id: 'acct_valid123',
        charges_enabled: true,
        details_submitted: true,
        requirements: { currently_due: [] },
      });
      const institutionModel = createInstitutionModelMock();
      institutionModel.findByIdAndUpdate.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });
      const { service } = createService({ institutionModel });

      await expect(
        service.verifyStripeConnectAccount(INSTITUTION_ID, dto, USER_ID),
      ).rejects.toThrow(`Instituição ${INSTITUTION_ID} não encontrada.`);
    });

    it('updates the institution and returns the refreshed profile on success', async () => {
      mockStripeAccountsRetrieve.mockResolvedValue({
        id: 'acct_valid123',
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: true,
        country: 'BR',
        default_currency: 'brl',
        requirements: { currently_due: ['individual.id_number'], disabled_reason: null },
      });
      const institutionModel = createInstitutionModelMock();
      const updatedDoc = baseInstitutionDoc({ stripeConnectAccountId: 'acct_valid123' });
      institutionModel.findByIdAndUpdate.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(updatedDoc) }),
      });
      institutionModel.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(updatedDoc) }),
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(updatedDoc),
          }),
        }),
      });
      const { service, institutionModel: model } = createService({
        institutionModel,
      });

      const result = await service.verifyStripeConnectAccount(
        INSTITUTION_ID,
        dto,
        USER_ID,
      );

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        INSTITUTION_ID,
        expect.objectContaining({
          stripeConnectAccountId: 'acct_valid123',
          stripeConnect: expect.objectContaining({ ready: true }),
        }),
        { returnDocument: 'after' },
      );
      expect(result.id).toBe(INSTITUTION_ID);
    });
  });

  describe('update', () => {
    it('updates and invalidates the cache', async () => {
      const institutionModel = createInstitutionModelMock();
      const updated = baseInstitutionDoc();
      institutionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });
      const { service, redisService } = createService({ institutionModel });

      const result = await service.update(INSTITUTION_ID, {
        displayName: 'Novo nome',
      } as any);

      expect(result).toBe(updated);
      expect(redisService.del).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('throws NotFoundException when the institution does not exist', async () => {
      const { service } = createService();

      await expect(service.approve(INSTITUTION_ID, USER_ID)).rejects.toThrow(
        `Instituição ${INSTITUTION_ID} não encontrada.`,
      );
    });

    it('activates the institution, logs an audit entry, and invalidates cache', async () => {
      const institutionModel = createInstitutionModelMock();
      const approvedDoc = baseInstitutionDoc({ status: InstitutionStatus.ACTIVE });
      institutionModel.findByIdAndUpdate.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(approvedDoc) }),
      });
      const { service, auditLogModel, redisService } = createService({
        institutionModel,
      });

      const result = await service.approve(INSTITUTION_ID, USER_ID);

      expect(result.status).toBe(InstitutionStatus.ACTIVE);
      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'institution.approve' }),
      );
      expect(redisService.del).toHaveBeenCalled();
    });

    it('omits the actor when the actor id is not a valid ObjectId', async () => {
      const institutionModel = createInstitutionModelMock();
      const approvedDoc = baseInstitutionDoc({ status: InstitutionStatus.ACTIVE });
      institutionModel.findByIdAndUpdate.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(approvedDoc) }),
      });
      const { service, auditLogModel } = createService({ institutionModel });

      await service.approve(INSTITUTION_ID, 'not-an-id');

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: undefined }),
      );
    });
  });

  describe('reject', () => {
    it('throws NotFoundException when the institution does not exist', async () => {
      const { service } = createService();

      await expect(service.reject(INSTITUTION_ID, USER_ID)).rejects.toThrow(
        `Instituição ${INSTITUTION_ID} não encontrada.`,
      );
    });

    it('rejects the institution and logs an audit entry', async () => {
      const institutionModel = createInstitutionModelMock();
      const rejectedDoc = baseInstitutionDoc({ status: InstitutionStatus.REJECTED });
      institutionModel.findByIdAndUpdate.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(rejectedDoc) }),
      });
      const { service, auditLogModel } = createService({ institutionModel });

      const result = await service.reject(INSTITUTION_ID, USER_ID);

      expect(result.status).toBe(InstitutionStatus.REJECTED);
      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'institution.reject' }),
      );
    });
  });

  describe('remove', () => {
    it('deletes the institution and invalidates the cache', async () => {
      const institutionModel = createInstitutionModelMock();
      const deleted = baseInstitutionDoc();
      institutionModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deleted),
      });
      const { service, redisService } = createService({ institutionModel });

      const result = await service.remove(INSTITUTION_ID);

      expect(result).toBe(deleted);
      expect(redisService.del).toHaveBeenCalled();
    });
  });
});
