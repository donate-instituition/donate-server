import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  it('returns campaigns compatible with the app contract', async () => {
    const service = new CampaignsService();

    const campaigns = await service.findAll();

    expect(Array.isArray(campaigns)).toBe(true);
    expect(campaigns.length).toBeGreaterThan(0);
    expect(campaigns[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        institution: expect.any(String),
        institutionId: expect.any(String),
        category: expect.any(String),
        goalFormatted: expect.any(String),
        raisedFormatted: expect.any(String),
        goalCents: expect.any(Number),
        raisedCents: expect.any(Number),
        progress: expect.any(Number),
        active: expect.any(Boolean),
      }),
    );
  });

  it('returns campaign details with the app fields', async () => {
    const service = new CampaignsService();

    const campaign = await service.findOne('1');

    expect(campaign).toEqual(
      expect.objectContaining({
        id: '1',
        description: expect.any(String),
        donorsCount: expect.any(Number),
      }),
    );
  });
});
