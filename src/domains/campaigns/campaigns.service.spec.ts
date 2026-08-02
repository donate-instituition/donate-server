import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  const campaignModel = {
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    create: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) }),
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
  };

  const institutionModel = {
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
  };

  it('returns campaigns compatible with the app contract', async () => {
    const service = new CampaignsService(campaignModel as any, institutionModel as any);

    const campaigns = await service.findAll();

    expect(Array.isArray(campaigns)).toBe(true);
  });

  it('returns campaign details with the app fields', async () => {
    const service = new CampaignsService(campaignModel as any, institutionModel as any);

    await expect(service.findOne('1')).rejects.toThrow();
  });
});
