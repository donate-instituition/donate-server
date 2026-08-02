import { DonationsService } from './donations.service';

describe('DonationsService', () => {
  it('returns a donation list with the app contract', async () => {
    const service = new DonationsService();

    const donations = await service.findAll();

    expect(Array.isArray(donations)).toBe(true);
    expect(donations.length).toBeGreaterThan(0);
    expect(donations[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        campaignId: expect.any(String),
        campaignTitle: expect.any(String),
        institutionName: expect.any(String),
        amountCents: expect.any(Number),
        amountFormatted: expect.any(String),
        status: expect.any(String),
        createdAt: expect.any(String),
      }),
    );
  });

  it('creates a donation payload for the app', async () => {
    const service = new DonationsService();

    const response = await service.create({
      campaignId: '1',
      amountCents: 5000,
    });

    expect(response).toEqual(
      expect.objectContaining({
        donation: expect.objectContaining({
          campaignId: '1',
          amountCents: 5000,
        }),
      }),
    );
  });
});
