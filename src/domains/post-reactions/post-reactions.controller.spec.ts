import { PostReactionsController } from './post-reactions.controller';

function createPostReactionsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'reaction-1' }),
    removeMineByPost: jest.fn().mockResolvedValue({ postId: 'post-1' }),
    getMyLikedPostIds: jest.fn().mockResolvedValue(['post-1']),
    findAll: jest.fn().mockResolvedValue([{ id: 'reaction-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'reaction-1' }),
    update: jest.fn().mockResolvedValue({ id: 'reaction-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'reaction-1' }),
  };
}

function createController() {
  const postReactionsService = createPostReactionsServiceMock();
  const controller = new PostReactionsController(postReactionsService as any);
  return { controller, postReactionsService };
}

const user = { sub: 'user-1' } as any;

describe('PostReactionsController', () => {
  it('delegates create to the service with the current user id', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.create({ postId: 'post-1' } as any, user);

    expect(postReactionsService.create).toHaveBeenCalledWith(
      { postId: 'post-1' },
      'user-1',
    );
    expect(result).toEqual({ id: 'reaction-1' });
  });

  it('delegates removeMineByPost to the service', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.removeMineByPost('post-1', user);

    expect(postReactionsService.removeMineByPost).toHaveBeenCalledWith(
      'post-1',
      'user-1',
    );
    expect(result).toEqual({ postId: 'post-1' });
  });

  it('delegates getMyLikedPostIds to the service', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.getMyLikedPostIds(user);

    expect(postReactionsService.getMyLikedPostIds).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(['post-1']);
  });

  it('delegates getMyLikedPostIds with undefined when unauthenticated', async () => {
    const { controller, postReactionsService } = createController();

    await controller.getMyLikedPostIds(undefined);

    expect(postReactionsService.getMyLikedPostIds).toHaveBeenCalledWith(undefined);
  });

  it('delegates findAll to the service', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.findAll();

    expect(postReactionsService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'reaction-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.findOne('reaction-1');

    expect(postReactionsService.findOne).toHaveBeenCalledWith('reaction-1');
    expect(result).toEqual({ id: 'reaction-1' });
  });

  it('delegates update to the service', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.update('reaction-1', { type: 'LIKE' } as any);

    expect(postReactionsService.update).toHaveBeenCalledWith('reaction-1', {
      type: 'LIKE',
    });
    expect(result).toEqual({ id: 'reaction-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, postReactionsService } = createController();

    const result = await controller.remove('reaction-1');

    expect(postReactionsService.remove).toHaveBeenCalledWith('reaction-1');
    expect(result).toEqual({ id: 'reaction-1' });
  });
});
