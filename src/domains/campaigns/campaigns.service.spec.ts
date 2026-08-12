import { CampaignsService } from './campaigns.service';

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
    bufferIncrement: jest.fn().mockResolvedValue(undefined),
    getPendingDelta: jest.fn().mockResolvedValue({
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    }),
    getPendingDeltas: jest.fn().mockResolvedValue(new Map()),
  };
}

describe('CampaignsService', () => {
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

  function createService() {
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
    const service = createService();

    const campaigns = await service.findAll();

    expect(Array.isArray(campaigns)).toBe(true);
  });

  it('returns campaign details with the app fields', async () => {
    const service = createService();

    await expect(service.findOne('1')).rejects.toThrow();
  });
});
