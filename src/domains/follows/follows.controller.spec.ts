import { FollowsController } from './follows.controller';

describe('FollowsController', () => {
  function createServiceMock() {
    return {
      create: jest.fn().mockResolvedValue({ id: 'follow-1' }),
      findMine: jest.fn().mockResolvedValue([{ id: 'follow-1' }]),
      findAll: jest.fn().mockResolvedValue([{ id: 'follow-1' }, { id: 'follow-2' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'follow-1' }),
      update: jest.fn().mockResolvedValue({ id: 'follow-1', targetType: 'CAMPAIGN' }),
      remove: jest.fn().mockResolvedValue({ id: 'follow-1' }),
      removeByTarget: jest
        .fn()
        .mockResolvedValue({ targetType: 'CAMPAIGN', targetId: 'c-1' }),
    };
  }

  function createController() {
    const followsService = createServiceMock();
    const controller = new FollowsController(followsService as any);
    return { controller, followsService };
  }

  it('delegates create with the dto and current user id', async () => {
    const { controller, followsService } = createController();
    const dto = { targetType: 'CAMPAIGN', targetId: 'c-1' } as any;

    const result = await controller.create(dto, { sub: 'user-1' } as any);

    expect(followsService.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual({ id: 'follow-1' });
  });

  it('delegates create with undefined user id when unauthenticated', async () => {
    const { controller, followsService } = createController();
    const dto = { targetType: 'CAMPAIGN', targetId: 'c-1' } as any;

    await controller.create(dto, undefined);

    expect(followsService.create).toHaveBeenCalledWith(dto, undefined);
  });

  it('delegates findMine with the current user id', async () => {
    const { controller, followsService } = createController();

    const result = await controller.findMine({ sub: 'user-1' } as any);

    expect(followsService.findMine).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'follow-1' }]);
  });

  it('delegates findAll', async () => {
    const { controller, followsService } = createController();

    const result = await controller.findAll();

    expect(followsService.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('delegates findOne with the id', async () => {
    const { controller, followsService } = createController();

    const result = await controller.findOne('follow-1');

    expect(followsService.findOne).toHaveBeenCalledWith('follow-1');
    expect(result).toEqual({ id: 'follow-1' });
  });

  it('delegates update with the id and dto', async () => {
    const { controller, followsService } = createController();
    const dto = { targetType: 'CAMPAIGN' } as any;

    const result = await controller.update('follow-1', dto);

    expect(followsService.update).toHaveBeenCalledWith('follow-1', dto);
    expect(result).toEqual({ id: 'follow-1', targetType: 'CAMPAIGN' });
  });

  it('delegates remove with the id', async () => {
    const { controller, followsService } = createController();

    const result = await controller.remove('follow-1');

    expect(followsService.remove).toHaveBeenCalledWith('follow-1');
    expect(result).toEqual({ id: 'follow-1' });
  });

  it('delegates removeByTarget with targetType, targetId and current user id', async () => {
    const { controller, followsService } = createController();

    const result = await controller.removeByTarget('CAMPAIGN', 'c-1', {
      sub: 'user-1',
    } as any);

    expect(followsService.removeByTarget).toHaveBeenCalledWith(
      'CAMPAIGN',
      'c-1',
      'user-1',
    );
    expect(result).toEqual({ targetType: 'CAMPAIGN', targetId: 'c-1' });
  });
});
