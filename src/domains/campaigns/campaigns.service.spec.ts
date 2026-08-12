import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { CampaignsService } from './campaigns.service';
import { CampaignStatus, CampaignDonationType } from './models';
import { InstitutionStaffMembershipRole } from '../institution-staff-memberships/models';

function execResolve(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function leanExec(value: unknown) {
  return { lean: jest.fn().mockReturnValue(execResolve(value)) };
}

function createRedisServiceMock() {
  return {
    cacheAside: jest.fn((_key: string, _ttl: number, loader: () => unknown) =>
      loader(),
    ),
    del: jest.fn().mockResolvedValue(0),
    get: jest.fn().mockResolvedValue(null),
    increment: jest.fn().mockResolvedValue(1),
  };
}

function createCountersServiceMock() {
  return {
    bufferIncrement: jest.fn(
      (
        _entityType: string,
        _entityId: string,
        _counter: string,
        _delta: number,
        fallback: () => Promise<void>,
      ) => fallback(),
    ),
    getPendingDelta: jest.fn().mockResolvedValue({
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    }),
    getPendingDeltas: jest.fn().mockResolvedValue(new Map()),
  };
}

function createCampaignModelMock() {
  return {
    countDocuments: jest.fn().mockReturnValue(execResolve(1)),
    create: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue(execResolve([])),
          }),
        }),
      }),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(execResolve(null)),
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(execResolve(null)),
      }),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue(execResolve(null)),
    findByIdAndDelete: jest.fn().mockReturnValue(execResolve(null)),
    exists: jest.fn().mockReturnValue(execResolve(null)),
    updateOne: jest.fn().mockReturnValue(execResolve({})),
  };
}

function createInstitutionModelMock() {
  return {
    countDocuments: jest.fn().mockReturnValue(execResolve(1)),
    create: jest.fn().mockResolvedValue([]),
    find: jest.fn().mockReturnValue(leanExec([])),
    findById: jest.fn().mockReturnValue(leanExec(null)),
  };
}

function createUserModelMock() {
  return {
    findById: jest.fn().mockReturnValue(leanExec(null)),
  };
}

function createInstitutionStaffMembershipModelMock() {
  return {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue(leanExec(null)),
      lean: jest.fn().mockReturnValue(execResolve(null)),
    }),
  };
}

function createDonationModelMock() {
  return {
    aggregate: jest.fn().mockResolvedValue([]),
    distinct: jest.fn().mockResolvedValue([]),
  };
}

function createCampaignCommentModelMock() {
  return {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue(execResolve([])),
      }),
    }),
    create: jest.fn().mockResolvedValue({}),
  };
}

function createCampaignReactionModelMock() {
  return {
    findOne: jest.fn().mockReturnValue(execResolve(null)),
    create: jest.fn().mockResolvedValue({}),
    findOneAndDelete: jest.fn().mockReturnValue(execResolve(null)),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue(leanExec([])),
    }),
  };
}

type Overrides = Partial<{
  campaignModel: any;
  campaignCommentModel: any;
  campaignReactionModel: any;
  institutionModel: any;
  userModel: any;
  institutionStaffMembershipModel: any;
  donationModel: any;
  redisService: any;
  countersService: any;
}>;

function createService(overrides: Overrides = {}) {
  const campaignModel = overrides.campaignModel ?? createCampaignModelMock();
  const campaignCommentModel =
    overrides.campaignCommentModel ?? createCampaignCommentModelMock();
  const campaignReactionModel =
    overrides.campaignReactionModel ?? createCampaignReactionModelMock();
  const institutionModel =
    overrides.institutionModel ?? createInstitutionModelMock();
  const userModel = overrides.userModel ?? createUserModelMock();
  const institutionStaffMembershipModel =
    overrides.institutionStaffMembershipModel ??
    createInstitutionStaffMembershipModelMock();
  const donationModel = overrides.donationModel ?? createDonationModelMock();
  const redisService = overrides.redisService ?? createRedisServiceMock();
  const countersService =
    overrides.countersService ?? createCountersServiceMock();

  const service = new CampaignsService(
    campaignModel as any,
    campaignCommentModel as any,
    campaignReactionModel as any,
    institutionModel as any,
    userModel as any,
    institutionStaffMembershipModel as any,
    donationModel as any,
    redisService as any,
    countersService as any,
  );

  return {
    service,
    campaignModel,
    campaignCommentModel,
    campaignReactionModel,
    institutionModel,
    userModel,
    institutionStaffMembershipModel,
    donationModel,
    redisService,
    countersService,
  };
}

function objectId() {
  return new Types.ObjectId().toString();
}

describe('CampaignsService', () => {
  // --- original tests (kept as-is / behavior preserved) ---
  const campaignModel = {
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
    findById: jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }),
  };

  const campaignCommentModel = {};
  const campaignReactionModel = {};

  const institutionModel = {
    countDocuments: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    find: jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }),
  };

  const userModel = {};
  const institutionStaffMembershipModel = {};
  const donationModel = {};

  function createLegacyService() {
    return new CampaignsService(
      campaignModel as any,
      campaignCommentModel as any,
      campaignReactionModel as any,
      institutionModel as any,
      userModel as any,
      institutionStaffMembershipModel as any,
      donationModel as any,
      createRedisServiceMock() as any,
      createCountersServiceMock() as any,
    );
  }

  it('returns campaigns compatible with the app contract', async () => {
    const service = createLegacyService();

    const campaigns = await service.findAll();

    expect(Array.isArray(campaigns)).toBe(true);
  });

  it('returns campaign details with the app fields', async () => {
    const service = createLegacyService();

    await expect(service.findOne('1')).rejects.toThrow();
  });

  it('falls back to cache version 0 when redis fails to read the version', async () => {
    const redisService = createRedisServiceMock();
    redisService.get.mockRejectedValue(new Error('redis down'));

    const { service } = createService({ redisService });

    const campaigns = await service.findAll();

    expect(Array.isArray(campaigns)).toBe(true);
  });

  // --- create() / ensureSeedData() ---
  describe('create', () => {
    it('creates the campaign directly when seed data already exists', async () => {
      const created = { _id: objectId(), title: 'Nova campanha' };
      const { service, campaignModel: cm, redisService } = createService({
        campaignModel: (() => {
          const m = createCampaignModelMock();
          m.create.mockResolvedValue(created);
          return m;
        })(),
      });

      const dto: any = { title: 'Nova campanha' };
      const result = await service.create(dto);

      expect(cm.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
      expect(redisService.increment).toHaveBeenCalledWith(
        'cache:version:campaigns',
      );
    });

    it('seeds institutions and campaigns when the database is empty', async () => {
      const cm = createCampaignModelMock();
      cm.countDocuments.mockReturnValue(execResolve(0));

      const inst = createInstitutionModelMock();
      inst.countDocuments.mockReturnValue(execResolve(0));

      const { service } = createService({
        campaignModel: cm,
        institutionModel: inst,
      });

      await service.create({ title: 'x' } as any);

      expect(inst.create).toHaveBeenCalledTimes(1);
      const institutionsArg = inst.create.mock.calls[0][0];
      expect(institutionsArg).toHaveLength(2);
      expect(institutionsArg[0].legalName).toBe('Educação Viva');

      // seed campaigns + the requested campaign
      expect(cm.create).toHaveBeenCalledTimes(2);
      const seedArg = cm.create.mock.calls[0][0];
      expect(Array.isArray(seedArg)).toBe(true);
      expect(seedArg[0].title).toBe('Material Escolar 2026');
    });

    it('skips institution seeding when institutions already exist', async () => {
      const cm = createCampaignModelMock();
      cm.countDocuments.mockReturnValue(execResolve(0));

      const inst = createInstitutionModelMock();
      inst.countDocuments.mockReturnValue(execResolve(1));
      inst.find.mockReturnValue(
        leanExec([{ _id: objectId() }, { _id: objectId() }]),
      );

      const { service } = createService({
        campaignModel: cm,
        institutionModel: inst,
      });

      await service.create({ title: 'x' } as any);

      expect(inst.create).not.toHaveBeenCalled();
      expect(cm.create).toHaveBeenCalledTimes(2);
    });
  });

  // --- createForCurrentInstitution() ---
  describe('createForCurrentInstitution', () => {
    it('rejects when the user id is missing or invalid', async () => {
      const { service } = createService();

      await expect(
        service.createForCurrentInstitution({ title: 'x' } as any, undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the user has no active membership', async () => {
      const { service } = createService();

      await expect(
        service.createForCurrentInstitution({ title: 'x' } as any, objectId()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the linked institution cannot be found', async () => {
      const membership = {
        institutionId: objectId(),
        role: InstitutionStaffMembershipRole.ADMIN,
      };
      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(membership)),
        lean: jest.fn().mockReturnValue(execResolve(membership)),
      });

      const { service } = createService({
        institutionStaffMembershipModel: membershipModel,
      });

      await expect(
        service.createForCurrentInstitution({ title: 'x' } as any, objectId()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the institution stripe account is not ready', async () => {
      const membership = {
        institutionId: objectId(),
        role: InstitutionStaffMembershipRole.ADMIN,
      };
      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(membership)),
        lean: jest.fn().mockReturnValue(execResolve(membership)),
      });

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ stripeConnect: { ready: false } }),
      );

      const { service } = createService({
        institutionStaffMembershipModel: membershipModel,
        institutionModel: inst,
      });

      await expect(
        service.createForCurrentInstitution({ title: 'x' } as any, objectId()),
      ).rejects.toThrow(BadRequestException);
    });

    it('publishes directly when the requester can publish', async () => {
      const institutionId = objectId();
      const membership = {
        institutionId,
        role: InstitutionStaffMembershipRole.ADMIN,
      };
      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(membership)),
        lean: jest.fn().mockReturnValue(execResolve(membership)),
      });

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ stripeConnect: { ready: true } }),
      );

      const createdId = objectId();
      const cm = createCampaignModelMock();
      cm.create.mockResolvedValue({ _id: createdId });
      cm.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue(
            execResolve({ _id: createdId, status: CampaignStatus.PUBLISHED }),
          ),
        select: jest.fn().mockReturnValue(leanExec(null)),
      });

      const { service } = createService({
        institutionStaffMembershipModel: membershipModel,
        institutionModel: inst,
        campaignModel: cm,
      });

      const result = await service.createForCurrentInstitution(
        {
          title: 'Campanha nova',
          status: CampaignStatus.PUBLISHED,
        } as any,
        objectId(),
      );

      expect(cm.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: CampaignStatus.PUBLISHED }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: createdId, status: CampaignStatus.PUBLISHED }),
      );
    });

    it('forces IN_REVIEW when the requester cannot publish', async () => {
      const institutionId = objectId();
      const membership = {
        institutionId,
        role: InstitutionStaffMembershipRole.VOLUNTEER,
      };
      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(membership)),
        lean: jest.fn().mockReturnValue(execResolve(membership)),
      });

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ stripeConnect: { ready: true } }),
      );

      const createdId = objectId();
      const cm = createCampaignModelMock();
      cm.create.mockResolvedValue({ _id: createdId });
      cm.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue(
            execResolve({ _id: createdId, status: CampaignStatus.IN_REVIEW }),
          ),
        select: jest.fn().mockReturnValue(leanExec(null)),
      });

      const { service } = createService({
        institutionStaffMembershipModel: membershipModel,
        institutionModel: inst,
        campaignModel: cm,
      });

      await service.createForCurrentInstitution(
        {
          title: 'Campanha nova',
          status: CampaignStatus.PUBLISHED,
          donationTypes: [],
        } as any,
        objectId(),
      );

      expect(cm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CampaignStatus.IN_REVIEW,
          donationTypes: [CampaignDonationType.MONEY],
        }),
      );
    });
  });

  // --- publishForCurrentInstitution() ---
  describe('publishForCurrentInstitution', () => {
    it('rejects when the user id is missing or invalid', async () => {
      const { service } = createService();

      await expect(
        service.publishForCurrentInstitution(objectId(), undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the campaign does not exist', async () => {
      const { service } = createService();

      await expect(
        service.publishForCurrentInstitution(objectId(), objectId()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the institution does not exist', async () => {
      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue(leanExec({ institutionId: objectId() }));

      const { service } = createService({ campaignModel: cm });

      await expect(
        service.publishForCurrentInstitution(objectId(), objectId()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the institution stripe account is not ready', async () => {
      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue(leanExec({ institutionId: objectId() }));

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ stripeConnect: { ready: false } }),
      );

      const { service } = createService({
        campaignModel: cm,
        institutionModel: inst,
      });

      await expect(
        service.publishForCurrentInstitution(objectId(), objectId()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the requester lacks a publisher membership', async () => {
      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue(leanExec({ institutionId: objectId() }));

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ stripeConnect: { ready: true } }),
      );

      const { service } = createService({
        campaignModel: cm,
        institutionModel: inst,
      });

      await expect(
        service.publishForCurrentInstitution(objectId(), objectId()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('publishes the campaign when the requester is an authorized publisher', async () => {
      const id = objectId();
      const institutionId = objectId();
      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue(
            execResolve({ _id: id, institutionId, status: CampaignStatus.PUBLISHED }),
          ),
        select: jest.fn().mockReturnValue(leanExec(null)),
      });
      cm.findByIdAndUpdate.mockReturnValue(
        execResolve({ _id: id, status: CampaignStatus.PUBLISHED }),
      );

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ stripeConnect: { ready: true } }),
      );

      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec({ institutionId })),
        lean: jest
          .fn()
          .mockReturnValue(execResolve({ institutionId, role: 'ADMIN' })),
      });

      const { service, redisService } = createService({
        campaignModel: cm,
        institutionModel: inst,
        institutionStaffMembershipModel: membershipModel,
      });

      const result = await service.publishForCurrentInstitution(id, objectId());

      expect(cm.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { status: CampaignStatus.PUBLISHED },
        { returnDocument: 'after' },
      );
      expect(redisService.del).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ id, status: CampaignStatus.PUBLISHED }),
      );
    });
  });

  // --- findAll() ---
  describe('findAll', () => {
    it('returns a paginated response with merged institution + delta data', async () => {
      const campaignA = {
        _id: objectId(),
        title: 'Campanha A',
        institutionId: objectId(),
        status: CampaignStatus.PUBLISHED,
        goal: { moneyTarget: 100 },
        progress: { moneyRaised: 50 },
        stats: { likesCount: 1, commentsCount: 2, sharesCount: 3 },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        endAt: new Date('2099-01-01T00:00:00.000Z'),
      };
      const institution = {
        _id: campaignA.institutionId,
        displayName: 'Instituição A',
      };

      const cm = createCampaignModelMock();
      const sortMock = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue(execResolve([campaignA])),
          }),
        }),
      });
      cm.find.mockReturnValue({ sort: sortMock });
      cm.countDocuments.mockReturnValue(execResolve(1));

      const inst = createInstitutionModelMock();
      inst.find.mockReturnValue(leanExec([institution]));

      const countersService = createCountersServiceMock();
      countersService.getPendingDeltas.mockResolvedValue(
        new Map([
          [
            campaignA._id,
            { likesCount: 10, commentsCount: 0, sharesCount: 0 },
          ],
        ]),
      );

      const { service } = createService({
        campaignModel: cm,
        institutionModel: inst,
        countersService,
      });

      const result = await service.findAll({ page: '1', limit: '10' });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.institution).toBe('Instituição A');
      expect(item.goalFormatted).toBe('R$ 100,00');
      expect(item.raisedFormatted).toBe('R$ 50,00');
      expect(item.progress).toBe(50);
      expect(item.likesCount).toBe(11);
      expect(item.active).toBe(true);
      expect(result.meta.total).toBe(1);
    });

    it('applies a search filter to the query', async () => {
      const cm = createCampaignModelMock();
      const { service } = createService({ campaignModel: cm });

      await service.findAll({ search: 'escola' });

      expect(cm.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CampaignStatus.PUBLISHED,
          $or: expect.any(Array),
        }),
      );
    });

    it('sorts by oldest first when requested', async () => {
      const cm = createCampaignModelMock();
      const sortMock = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue(execResolve([])),
          }),
        }),
      });
      cm.find.mockReturnValue({ sort: sortMock });

      const { service } = createService({ campaignModel: cm });

      await service.findAll({ sort: 'oldest' });

      expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  // --- findMine() ---
  describe('findMine', () => {
    it('rejects when the user has no active membership', async () => {
      const { service } = createService();

      await expect(service.findMine(objectId())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the institution campaigns for the active membership', async () => {
      const institutionId = objectId();
      const membership = { institutionId, role: 'ADMIN' };
      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(membership)),
        lean: jest.fn().mockReturnValue(execResolve(membership)),
      });

      const campaign = {
        _id: objectId(),
        title: 'Minha campanha',
        institutionId,
        status: CampaignStatus.IN_REVIEW,
        goal: { moneyTarget: 0 },
        progress: { moneyRaised: 0 },
      };
      const cm = createCampaignModelMock();
      cm.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue(execResolve([campaign])),
            }),
          }),
        }),
      });

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ _id: institutionId, displayName: 'Minha Instituição' }),
      );

      const { service } = createService({
        institutionStaffMembershipModel: membershipModel,
        campaignModel: cm,
        institutionModel: inst,
      });

      const result = await service.findMine(objectId(), { search: 'foo' });

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].institution).toBe('Minha Instituição');
    });

    it('returns a paginated response when pagination params are set', async () => {
      const institutionId = objectId();
      const membership = { institutionId, role: 'ADMIN' };
      const membershipModel = createInstitutionStaffMembershipModelMock();
      membershipModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(membership)),
        lean: jest.fn().mockReturnValue(execResolve(membership)),
      });

      const cm = createCampaignModelMock();
      cm.countDocuments.mockReturnValue(execResolve(7));

      const { service } = createService({
        institutionStaffMembershipModel: membershipModel,
        campaignModel: cm,
      });

      const result = await service.findMine(objectId(), { page: '1' });

      expect(result.meta.total).toBe(7);
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  // --- findOne() ---
  describe('findOne', () => {
    it('rejects when the campaign does not exist', async () => {
      const { service } = createService();

      await expect(service.findOne(objectId())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns campaign details merged with pending deltas', async () => {
      const id = objectId();
      const institutionId = objectId();
      const campaign = {
        _id: id,
        title: 'Campanha Detalhe',
        institutionId,
        status: CampaignStatus.PUBLISHED,
        goal: { moneyTarget: 10 },
        progress: { moneyRaised: 5 },
        stats: { donationsCount: 4, likesCount: 1, commentsCount: 1, sharesCount: 1 },
        acceptedItems: [{ name: 'Arroz', category: 'FOOD' }],
      };

      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue(leanExec(campaign));

      const inst = createInstitutionModelMock();
      inst.findById.mockReturnValue(
        leanExec({ _id: institutionId, displayName: 'Instituição X' }),
      );

      const countersService = createCountersServiceMock();
      countersService.getPendingDelta.mockResolvedValue({
        likesCount: 2,
        commentsCount: 0,
        sharesCount: 0,
      });

      const { service } = createService({
        campaignModel: cm,
        institutionModel: inst,
        countersService,
      });

      const result = await service.findOne(id);

      expect(result.id).toBe(id);
      expect(result.donorsCount).toBe(4);
      expect(result.itemsNeeded).toEqual(['Arroz']);
      expect(result.likesCount).toBe(3);
      expect(result.description).toBe('Descrição da campanha indisponível.');
    });
  });

  // --- getRecentDonors() ---
  describe('getRecentDonors', () => {
    it('rejects an invalid campaign id', async () => {
      const { service } = createService();

      await expect(service.getRecentDonors('not-an-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns mapped donors and the distinct total', async () => {
      const userId = objectId();
      const donation = {
        _id: userId,
        donor: { fullName: 'Doador Um', profilePhotoUrl: 'photo.png' },
      };
      const dm = createDonationModelMock();
      dm.aggregate.mockResolvedValue([donation]);
      dm.distinct.mockResolvedValue([userId, objectId()]);

      const { service } = createService({ donationModel: dm });

      const result = await service.getRecentDonors(objectId());

      expect(result.donors).toEqual([
        { id: userId, name: 'Doador Um', profilePhotoUrl: 'photo.png' },
      ]);
      expect(result.totalCount).toBe(2);
    });

    it('clamps the requested limit between 1 and 20', async () => {
      const dm = createDonationModelMock();
      const { service } = createService({ donationModel: dm });

      await service.getRecentDonors(objectId(), 500);

      const aggregateArg = dm.aggregate.mock.calls[0][0];
      const limitStage = aggregateArg.find((stage: any) => stage.$limit);
      expect(limitStage.$limit).toBe(20);
    });
  });

  // --- update() / remove() ---
  describe('update', () => {
    it('updates the campaign and invalidates its cache entry', async () => {
      const id = objectId();
      const updated = { _id: id, title: 'Atualizada' };
      const cm = createCampaignModelMock();
      cm.findByIdAndUpdate.mockReturnValue(execResolve(updated));

      const { service, redisService } = createService({ campaignModel: cm });

      const result = await service.update(id, { title: 'Atualizada' } as any);

      expect(cm.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { title: 'Atualizada' },
        { returnDocument: 'after' },
      );
      expect(redisService.del).toHaveBeenCalled();
      expect(result).toBe(updated);
    });
  });

  describe('remove', () => {
    it('deletes the campaign and invalidates its cache entry', async () => {
      const id = objectId();
      const removed = { _id: id };
      const cm = createCampaignModelMock();
      cm.findByIdAndDelete.mockReturnValue(execResolve(removed));

      const { service, redisService } = createService({ campaignModel: cm });

      const result = await service.remove(id);

      expect(cm.findByIdAndDelete).toHaveBeenCalledWith(id);
      expect(redisService.del).toHaveBeenCalled();
      expect(result).toBe(removed);
    });
  });

  // --- comments ---
  describe('listComments', () => {
    it('rejects when the campaign does not exist', async () => {
      const { service } = createService();

      await expect(service.listComments(objectId())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the mapped comments for an existing campaign', async () => {
      const campaignId = objectId();
      const commentId = objectId();
      const author = {
        _id: objectId(),
        fullName: 'Autor',
        email: 'a@a.com',
        profilePhotoUrl: 'p.png',
      };
      const comment = {
        _id: commentId,
        campaignId,
        userId: author,
        content: 'Ótima campanha',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      };

      const cm = createCampaignModelMock();
      cm.exists.mockReturnValue(execResolve({ _id: campaignId }));

      const ccm = createCampaignCommentModelMock();
      ccm.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(execResolve([comment])),
        }),
      });

      const { service } = createService({
        campaignModel: cm,
        campaignCommentModel: ccm,
      });

      const result = await service.listComments(campaignId);

      expect(result).toEqual([
        expect.objectContaining({
          id: commentId,
          content: 'Ótima campanha',
          author: expect.objectContaining({ fullName: 'Autor' }),
        }),
      ]);
    });
  });

  describe('createComment', () => {
    it('rejects an empty comment', async () => {
      const { service } = createService();

      await expect(
        service.createComment(objectId(), '   ', objectId()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the campaign does not exist', async () => {
      const { service } = createService();

      await expect(
        service.createComment(objectId(), 'Olá', objectId()),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the comment, bumps the counter and returns it with the author', async () => {
      const campaignId = objectId();
      const authorId = objectId();
      const createdComment = {
        _id: objectId(),
        campaignId,
        userId: authorId,
        content: 'Muito bom!',
      };

      const cm = createCampaignModelMock();
      cm.exists.mockReturnValue(execResolve({ _id: campaignId }));

      const ccm = createCampaignCommentModelMock();
      ccm.create.mockResolvedValue(createdComment);

      const um = createUserModelMock();
      um.findById.mockReturnValue(
        leanExec({ _id: authorId, fullName: 'Fulano' }),
      );

      const countersService = createCountersServiceMock();

      const { service } = createService({
        campaignModel: cm,
        campaignCommentModel: ccm,
        userModel: um,
        countersService,
      });

      const result = await service.createComment(
        campaignId,
        'Muito bom!',
        authorId,
      );

      expect(ccm.create).toHaveBeenCalled();
      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'campaign',
        campaignId,
        'commentsCount',
        1,
        expect.any(Function),
      );
      expect(cm.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $inc: { 'stats.commentsCount': 1 } },
      );
      expect(result.content).toBe('Muito bom!');
      expect(result.author).toEqual(
        expect.objectContaining({ fullName: 'Fulano' }),
      );
    });
  });

  // --- like / unlike ---
  describe('like', () => {
    it('rejects when the campaign does not exist', async () => {
      const { service } = createService();

      await expect(service.like(objectId(), objectId())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is idempotent when the user already liked the campaign', async () => {
      const campaignId = objectId();
      const cm = createCampaignModelMock();
      cm.exists.mockReturnValue(execResolve({ _id: campaignId }));

      const crm = createCampaignReactionModelMock();
      crm.findOne.mockReturnValue(execResolve({ _id: objectId() }));

      const { service } = createService({
        campaignModel: cm,
        campaignReactionModel: crm,
      });

      const result = await service.like(campaignId, objectId());

      expect(crm.create).not.toHaveBeenCalled();
      expect(result).toEqual({ campaignId, liked: true });
    });

    it('creates the reaction and increments the counter', async () => {
      const campaignId = objectId();
      const cm = createCampaignModelMock();
      cm.exists.mockReturnValue(execResolve({ _id: campaignId }));

      const crm = createCampaignReactionModelMock();
      const countersService = createCountersServiceMock();

      const { service } = createService({
        campaignModel: cm,
        campaignReactionModel: crm,
        countersService,
      });

      const result = await service.like(campaignId, objectId());

      expect(crm.create).toHaveBeenCalled();
      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'campaign',
        campaignId,
        'likesCount',
        1,
        expect.any(Function),
      );
      expect(cm.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $inc: { 'stats.likesCount': 1 } },
      );
      expect(result).toEqual({ campaignId, liked: true });
    });
  });

  describe('unlike', () => {
    it('decrements the counter when a reaction existed', async () => {
      const campaignId = objectId();
      const crm = createCampaignReactionModelMock();
      crm.findOneAndDelete.mockReturnValue(execResolve({ _id: objectId() }));

      const countersService = createCountersServiceMock();

      const { service } = createService({
        campaignReactionModel: crm,
        countersService,
      });

      const result = await service.unlike(campaignId, objectId());

      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'campaign',
        campaignId,
        'likesCount',
        -1,
        expect.any(Function),
      );
      expect(result).toEqual({ campaignId, liked: false });
    });

    it('does nothing when no reaction existed', async () => {
      const countersService = createCountersServiceMock();
      const { service } = createService({ countersService });

      const result = await service.unlike(objectId(), objectId());

      expect(countersService.bufferIncrement).not.toHaveBeenCalled();
      expect(result.liked).toBe(false);
    });
  });

  describe('getMyLikedCampaignIds', () => {
    it('rejects an invalid user id', async () => {
      const { service } = createService();

      await expect(
        service.getMyLikedCampaignIds('not-an-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns the liked campaign ids as strings', async () => {
      const campaignIdA = objectId();
      const campaignIdB = objectId();
      const crm = createCampaignReactionModelMock();
      crm.find.mockReturnValue({
        select: jest
          .fn()
          .mockReturnValue(
            leanExec([{ campaignId: campaignIdA }, { campaignId: campaignIdB }]),
          ),
      });

      const { service } = createService({ campaignReactionModel: crm });

      const result = await service.getMyLikedCampaignIds(objectId());

      expect(result).toEqual([campaignIdA, campaignIdB]);
    });
  });

  // --- share() ---
  describe('share', () => {
    it('rejects when the campaign does not exist', async () => {
      const { service } = createService();

      await expect(service.share(objectId())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('increments the share counter and returns the merged total', async () => {
      const campaignId = objectId();
      const cm = createCampaignModelMock();
      cm.exists.mockReturnValue(execResolve({ _id: campaignId }));
      cm.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue(execResolve(null)),
        select: jest
          .fn()
          .mockReturnValue(leanExec({ stats: { sharesCount: 4 } })),
      });

      const countersService = createCountersServiceMock();
      countersService.getPendingDelta.mockResolvedValue({
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 1,
      });

      const { service } = createService({
        campaignModel: cm,
        countersService,
      });

      const result = await service.share(campaignId);

      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'campaign',
        campaignId,
        'sharesCount',
        1,
        expect.any(Function),
      );
      expect(cm.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $inc: { 'stats.sharesCount': 1 } },
      );
      expect(result).toEqual({ campaignId, sharesCount: 5 });
    });
  });

  // --- category / location resolution branches (exercised via findOne) ---
  describe('category and location resolution', () => {
    it('falls back to the accepted-item category and skips an invalid location', async () => {
      const id = objectId();
      const campaign = {
        _id: id,
        title: 'Campanha sem categoria',
        institutionId: objectId(),
        status: CampaignStatus.PAUSED,
        goal: { moneyTarget: 0 },
        progress: { moneyRaised: 0 },
        acceptedItems: [{ name: 'Roupas', category: 'CLOTHES' }],
        address: { location: { coordinates: [1] } },
      };

      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue(leanExec(campaign));

      const { service } = createService({ campaignModel: cm });

      const result = await service.findOne(id);

      expect(result.category).toBe('Outros');
      expect(result.location).toBeUndefined();
      expect(result.progress).toBe(0);
      expect(result.active).toBe(false);
    });

    it('resolves a valid location from the campaign address', async () => {
      const id = objectId();
      const campaign = {
        _id: id,
        title: 'Campanha com local',
        institutionId: objectId(),
        status: CampaignStatus.PUBLISHED,
        category: 'Saúde',
        goal: { moneyTarget: 0 },
        progress: { moneyRaised: 0 },
        address: { location: { coordinates: [-46.6333, -23.5505] } },
      };

      const cm = createCampaignModelMock();
      cm.findById.mockReturnValue(leanExec(campaign));

      const { service } = createService({ campaignModel: cm });

      const result = await service.findOne(id);

      expect(result.category).toBe('Saúde');
      expect(result.location).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
      });
    });
  });
});
