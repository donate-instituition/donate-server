import { PostCommentsController } from './post-comments.controller';

function createPostCommentsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    findByPost: jest.fn().mockResolvedValue([{ id: 'comment-1' }]),
    findAll: jest.fn().mockResolvedValue([{ id: 'comment-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    update: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'comment-1' }),
  };
}

function createController() {
  const postCommentsService = createPostCommentsServiceMock();
  const controller = new PostCommentsController(postCommentsService as any);
  return { controller, postCommentsService };
}

const user = { sub: 'user-1' } as any;

describe('PostCommentsController', () => {
  it('delegates create to the service with the current user id', async () => {
    const { controller, postCommentsService } = createController();

    const result = await controller.create({ postId: 'post-1' } as any, user);

    expect(postCommentsService.create).toHaveBeenCalledWith(
      { postId: 'post-1' },
      'user-1',
    );
    expect(result).toEqual({ id: 'comment-1' });
  });

  it('delegates create to the service with undefined user id when unauthenticated', async () => {
    const { controller, postCommentsService } = createController();

    await controller.create({ postId: 'post-1' } as any, undefined);

    expect(postCommentsService.create).toHaveBeenCalledWith(
      { postId: 'post-1' },
      undefined,
    );
  });

  it('delegates findByPost to the service', async () => {
    const { controller, postCommentsService } = createController();

    const result = await controller.findByPost('post-1');

    expect(postCommentsService.findByPost).toHaveBeenCalledWith('post-1');
    expect(result).toEqual([{ id: 'comment-1' }]);
  });

  it('delegates findAll to the service', async () => {
    const { controller, postCommentsService } = createController();

    const result = await controller.findAll();

    expect(postCommentsService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'comment-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, postCommentsService } = createController();

    const result = await controller.findOne('comment-1');

    expect(postCommentsService.findOne).toHaveBeenCalledWith('comment-1');
    expect(result).toEqual({ id: 'comment-1' });
  });

  it('delegates update to the service', async () => {
    const { controller, postCommentsService } = createController();

    const result = await controller.update('comment-1', { content: 'x' } as any);

    expect(postCommentsService.update).toHaveBeenCalledWith('comment-1', {
      content: 'x',
    });
    expect(result).toEqual({ id: 'comment-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, postCommentsService } = createController();

    const result = await controller.remove('comment-1');

    expect(postCommentsService.remove).toHaveBeenCalledWith('comment-1');
    expect(result).toEqual({ id: 'comment-1' });
  });
});
