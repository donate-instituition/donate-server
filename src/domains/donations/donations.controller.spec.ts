import { DonationsController } from './donations.controller';

function createDonationsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ donation: { id: 'don-1' } }),
    findMyDonations: jest.fn().mockResolvedValue([{ id: 'don-1' }]),
    findMyInstitutionDonations: jest.fn().mockResolvedValue([{ id: 'don-1' }]),
    findAll: jest.fn().mockResolvedValue([{ id: 'don-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'don-1' }),
    update: jest.fn().mockResolvedValue({ id: 'don-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'don-1' }),
  };
}

describe('DonationsController', () => {
  function createController() {
    const donationsService = createDonationsServiceMock();
    const controller = new DonationsController(donationsService as any);
    return { controller, donationsService };
  }

  it('delegates create to the service with the current user id', async () => {
    const { controller, donationsService } = createController();
    const dto = { campaignId: 'c-1', amountCents: 5000 } as any;
    const user = { sub: 'user-1' } as any;

    const result = await controller.create(dto, user);

    expect(donationsService.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual({ donation: { id: 'don-1' } });
  });

  it('delegates create to the service with an undefined user', async () => {
    const { controller, donationsService } = createController();
    const dto = { campaignId: 'c-1', amountCents: 5000 } as any;

    await controller.create(dto, undefined);

    expect(donationsService.create).toHaveBeenCalledWith(dto, undefined);
  });

  it('delegates findMyDonations to the service', async () => {
    const { controller, donationsService } = createController();
    const user = { sub: 'user-1' } as any;
    const query = { page: 1, limit: 10 } as any;

    const result = await controller.findMyDonations(user, query);

    expect(donationsService.findMyDonations).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual([{ id: 'don-1' }]);
  });

  it('delegates findMyInstitutionDonations to the service', async () => {
    const { controller, donationsService } = createController();
    const user = { sub: 'staff-1' } as any;
    const query = {} as any;

    const result = await controller.findMyInstitutionDonations(user, query);

    expect(donationsService.findMyInstitutionDonations).toHaveBeenCalledWith(
      'staff-1',
      query,
    );
    expect(result).toEqual([{ id: 'don-1' }]);
  });

  it('delegates findAll to the service', async () => {
    const { controller, donationsService } = createController();
    const query = { page: 2 } as any;

    const result = await controller.findAll(query);

    expect(donationsService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'don-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, donationsService } = createController();

    const result = await controller.findOne('don-1');

    expect(donationsService.findOne).toHaveBeenCalledWith('don-1');
    expect(result).toEqual({ id: 'don-1' });
  });

  it('delegates update to the service', async () => {
    const { controller, donationsService } = createController();
    const dto = { status: 'PAID' } as any;

    const result = await controller.update('don-1', dto);

    expect(donationsService.update).toHaveBeenCalledWith('don-1', dto);
    expect(result).toEqual({ id: 'don-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, donationsService } = createController();

    const result = await controller.remove('don-1');

    expect(donationsService.remove).toHaveBeenCalledWith('don-1');
    expect(result).toEqual({ id: 'don-1' });
  });
});
