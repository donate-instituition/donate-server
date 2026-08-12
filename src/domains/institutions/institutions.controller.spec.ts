import { InstitutionsController } from './institutions.controller';

describe('InstitutionsController', () => {
  function createServiceMock() {
    return {
      create: jest.fn().mockResolvedValue({ id: 'inst-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'inst-1' }]),
      findPending: jest.fn().mockResolvedValue([{ id: 'inst-2' }]),
      findAllForAdmin: jest.fn().mockResolvedValue([{ id: 'inst-3' }]),
      approve: jest.fn().mockResolvedValue({ id: 'inst-1', status: 'ACTIVE' }),
      reject: jest.fn().mockResolvedValue({ id: 'inst-1', status: 'REJECTED' }),
      findOne: jest.fn().mockResolvedValue({ id: 'inst-1' }),
      verifyStripeConnectAccount: jest
        .fn()
        .mockResolvedValue({ id: 'inst-1', stripeConnect: { ready: true } }),
      update: jest.fn().mockResolvedValue({ id: 'inst-1', displayName: 'Novo' }),
      remove: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    };
  }

  function createController() {
    const institutionsService = createServiceMock();
    const controller = new InstitutionsController(institutionsService as any);
    return { controller, institutionsService };
  }

  it('delegates create to the service', async () => {
    const { controller, institutionsService } = createController();
    const dto = { legalName: 'A', displayName: 'A' } as any;

    const result = await controller.create(dto);

    expect(institutionsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'inst-1' });
  });

  it('delegates findAll with the query', async () => {
    const { controller, institutionsService } = createController();
    const query = { search: 'foo' };

    const result = await controller.findAll(query as any);

    expect(institutionsService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'inst-1' }]);
  });

  it('delegates findPending with the query', async () => {
    const { controller, institutionsService } = createController();
    const query = { page: '1' };

    const result = await controller.findPending(query as any);

    expect(institutionsService.findPending).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'inst-2' }]);
  });

  it('delegates findAllForAdmin with the query', async () => {
    const { controller, institutionsService } = createController();
    const query = {};

    const result = await controller.findAllForAdmin(query as any);

    expect(institutionsService.findAllForAdmin).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'inst-3' }]);
  });

  it('delegates approve with the id and current user id', async () => {
    const { controller, institutionsService } = createController();

    const result = await controller.approve('inst-1', { sub: 'user-1' } as any);

    expect(institutionsService.approve).toHaveBeenCalledWith('inst-1', 'user-1');
    expect(result).toEqual({ id: 'inst-1', status: 'ACTIVE' });
  });

  it('delegates approve with undefined actor when there is no current user', async () => {
    const { controller, institutionsService } = createController();

    await controller.approve('inst-1', undefined);

    expect(institutionsService.approve).toHaveBeenCalledWith('inst-1', undefined);
  });

  it('delegates reject with the id and current user id', async () => {
    const { controller, institutionsService } = createController();

    const result = await controller.reject('inst-1', { sub: 'user-1' } as any);

    expect(institutionsService.reject).toHaveBeenCalledWith('inst-1', 'user-1');
    expect(result).toEqual({ id: 'inst-1', status: 'REJECTED' });
  });

  it('delegates findOne with the id', async () => {
    const { controller, institutionsService } = createController();

    const result = await controller.findOne('inst-1');

    expect(institutionsService.findOne).toHaveBeenCalledWith('inst-1');
    expect(result).toEqual({ id: 'inst-1' });
  });

  it('delegates verifyStripeConnectAccount with id, dto and current user id', async () => {
    const { controller, institutionsService } = createController();
    const dto = { stripeConnectAccountId: 'acct_123' };

    const result = await controller.verifyStripeConnectAccount(
      'inst-1',
      dto,
      { sub: 'user-1' } as any,
    );

    expect(institutionsService.verifyStripeConnectAccount).toHaveBeenCalledWith(
      'inst-1',
      dto,
      'user-1',
    );
    expect(result).toEqual({ id: 'inst-1', stripeConnect: { ready: true } });
  });

  it('delegates update with the id and dto', async () => {
    const { controller, institutionsService } = createController();
    const dto = { displayName: 'Novo' };

    const result = await controller.update('inst-1', dto);

    expect(institutionsService.update).toHaveBeenCalledWith('inst-1', dto);
    expect(result).toEqual({ id: 'inst-1', displayName: 'Novo' });
  });

  it('delegates remove with the id', async () => {
    const { controller, institutionsService } = createController();

    const result = await controller.remove('inst-1');

    expect(institutionsService.remove).toHaveBeenCalledWith('inst-1');
    expect(result).toEqual({ id: 'inst-1' });
  });
});
