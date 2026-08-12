import { PostsController } from './posts.controller';

function createPostsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'post-1' }),
    findAll: jest.fn().mockResolvedValue([{ id: 'post-1' }]),
    feed: jest.fn().mockResolvedValue([{ id: 'post-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'post-1' }),
    update: jest.fn().mockResolvedValue({ id: 'post-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'post-1' }),
    share: jest.fn().mockResolvedValue({ postId: 'post-1', sharesCount: 1 }),
  };
}

function createController() {
  const postsService = createPostsServiceMock();
  const controller = new PostsController(postsService as any);
  return { controller, postsService };
}

const user = { sub: 'user-1' } as any;

describe('PostsController', () => {
  it('delegates create to the service with the current user', async () => {
    const { controller, postsService } = createController();

    const result = await controller.create({ content: 'hi' } as any, user);

    expect(postsService.create).toHaveBeenCalledWith({ content: 'hi' }, user);
    expect(result).toEqual({ id: 'post-1' });
  });

  it('delegates findAll to the service with the query', async () => {
    const { controller, postsService } = createController();

    const result = await controller.findAll({ page: '1' } as any);

    expect(postsService.findAll).toHaveBeenCalledWith({ page: '1' });
    expect(result).toEqual([{ id: 'post-1' }]);
  });

  it('delegates feed to the service using the current user id', async () => {
    const { controller, postsService } = createController();

    const result = await controller.feed(user, { page: '1' } as any);

    expect(postsService.feed).toHaveBeenCalledWith('user-1', { page: '1' });
    expect(result).toEqual([{ id: 'post-1' }]);
  });

  it('delegates feed to the service with undefined user id when unauthenticated', async () => {
    const { controller, postsService } = createController();

    await controller.feed(undefined, {} as any);

    expect(postsService.feed).toHaveBeenCalledWith(undefined, {});
  });

  it('delegates share to the service', async () => {
    const { controller, postsService } = createController();

    const result = await controller.share('post-1');

    expect(postsService.share).toHaveBeenCalledWith('post-1');
    expect(result).toEqual({ postId: 'post-1', sharesCount: 1 });
  });

  it('delegates findOne to the service with the current user id', async () => {
    const { controller, postsService } = createController();

    const result = await controller.findOne('post-1', user);

    expect(postsService.findOne).toHaveBeenCalledWith('post-1', 'user-1');
    expect(result).toEqual({ id: 'post-1' });
  });

  it('delegates update to the service', async () => {
    const { controller, postsService } = createController();

    const result = await controller.update('post-1', { content: 'new' } as any);

    expect(postsService.update).toHaveBeenCalledWith('post-1', { content: 'new' });
    expect(result).toEqual({ id: 'post-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, postsService } = createController();

    const result = await controller.remove('post-1');

    expect(postsService.remove).toHaveBeenCalledWith('post-1');
    expect(result).toEqual({ id: 'post-1' });
  });
});
