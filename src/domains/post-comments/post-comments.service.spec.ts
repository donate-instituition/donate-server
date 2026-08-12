import { Types } from 'mongoose';

import { PostCommentsService } from './post-comments.service';

const POST_ID = new Types.ObjectId().toString();
const USER_ID = new Types.ObjectId().toString();
const COMMENT_ID = new Types.ObjectId().toString();
const PARENT_COMMENT_ID = new Types.ObjectId().toString();

function execResolve(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function leanExecResolve(value: unknown) {
  return { lean: jest.fn().mockReturnValue(execResolve(value)) };
}

function buildCommentDoc(overrides: Record<string, any> = {}) {
  return {
    _id: new Types.ObjectId(COMMENT_ID),
    postId: new Types.ObjectId(POST_ID),
    userId: new Types.ObjectId(USER_ID),
    content: 'hello',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createCountersServiceMock() {
  return {
    bufferIncrement: jest.fn().mockResolvedValue(undefined),
  };
}

function createModels() {
  const postCommentModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exists: jest.fn(),
  };

  const postModel = {
    exists: jest.fn(),
    updateOne: jest.fn().mockReturnValue(execResolve(undefined)),
  };

  const userModel = {
    findById: jest.fn(),
  };

  return { postCommentModel, postModel, userModel };
}

function createService(models = createModels()) {
  const countersService = createCountersServiceMock();
  const service = new PostCommentsService(
    models.postCommentModel as any,
    models.postModel as any,
    models.userModel as any,
    countersService as any,
  );

  return { service, countersService, ...models };
}

describe('PostCommentsService', () => {
  describe('create', () => {
    it('throws when content is blank', async () => {
      const { service } = createService();

      await expect(
        service.create({ postId: POST_ID, content: '   ' } as any, USER_ID),
      ).rejects.toThrow('Comment content is required');
    });

    it('throws NotFoundException when the post does not exist', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      await expect(
        service.create({ postId: POST_ID, content: 'hi' } as any, USER_ID),
      ).rejects.toThrow('Post not found');
    });

    it('throws NotFoundException when the parent comment does not exist', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      models.postCommentModel.exists.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      await expect(
        service.create(
          {
            postId: POST_ID,
            content: 'hi',
            parentCommentId: PARENT_COMMENT_ID,
          } as any,
          USER_ID,
        ),
      ).rejects.toThrow('Parent comment not found');
    });

    it('creates a top-level comment, buffers the counter and attaches the author', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      models.postCommentModel.create.mockResolvedValue(buildCommentDoc());
      models.userModel.findById.mockReturnValue(
        leanExecResolve({
          _id: USER_ID,
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          profilePhotoUrl: 'photo.png',
        }),
      );
      const { service, postCommentModel, countersService } = createService(models);

      const result: any = await service.create(
        { postId: POST_ID, content: '  hi  ' } as any,
        USER_ID,
      );

      expect(postCommentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'hi', parentCommentId: undefined }),
      );
      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'post',
        POST_ID,
        'commentsCount',
        1,
        expect.any(Function),
      );
      expect(result.author).toEqual(
        expect.objectContaining({ fullName: 'Jane Doe' }),
      );
    });

    it('creates a reply comment referencing the parent', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      models.postCommentModel.exists.mockReturnValue(execResolve({ _id: PARENT_COMMENT_ID }));
      models.postCommentModel.create.mockResolvedValue(
        buildCommentDoc({ parentCommentId: new Types.ObjectId(PARENT_COMMENT_ID) }),
      );
      models.userModel.findById.mockReturnValue(leanExecResolve(null));
      const { service, postCommentModel } = createService(models);

      const result: any = await service.create(
        {
          postId: POST_ID,
          content: 'reply',
          parentCommentId: PARENT_COMMENT_ID,
        } as any,
        USER_ID,
      );

      expect(postCommentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentCommentId: expect.any(Types.ObjectId),
        }),
      );
      expect(result.parentCommentId).toBe(PARENT_COMMENT_ID);
      expect(result.author).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns comments sorted by newest first', async () => {
      const models = createModels();
      models.postCommentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(execResolve([buildCommentDoc()])),
      });
      const { service } = createService(models);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });
  });

  describe('findByPost', () => {
    it('returns comments for a post with populated author info', async () => {
      const models = createModels();
      const commentWithAuthor = {
        ...buildCommentDoc(),
        userId: { _id: new Types.ObjectId(USER_ID), fullName: 'Jane Doe' },
      };
      models.postCommentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(execResolve([commentWithAuthor])),
        }),
      });
      const { service, postCommentModel } = createService(models);

      const result: any = await service.findByPost(POST_ID);

      expect(postCommentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ postId: expect.any(Types.ObjectId) }),
      );
      expect(result[0].author).toEqual(
        expect.objectContaining({ fullName: 'Jane Doe' }),
      );
    });
  });

  describe('findOne', () => {
    it('returns null when the comment does not exist', async () => {
      const models = createModels();
      models.postCommentModel.findById.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      const result = await service.findOne(COMMENT_ID);

      expect(result).toBeNull();
    });

    it('returns the mapped comment when found', async () => {
      const models = createModels();
      models.postCommentModel.findById.mockReturnValue(execResolve(buildCommentDoc()));
      const { service } = createService(models);

      const result: any = await service.findOne(COMMENT_ID);

      expect(result.id).toBe(COMMENT_ID);
    });
  });

  describe('update', () => {
    it('throws when content is explicitly set to blank', async () => {
      const { service } = createService();

      await expect(
        service.update(COMMENT_ID, { content: '   ' } as any),
      ).rejects.toThrow('Comment content is required');
    });

    it('trims content and updates the comment', async () => {
      const models = createModels();
      models.postCommentModel.findByIdAndUpdate.mockReturnValue(
        execResolve(buildCommentDoc({ content: 'updated' })),
      );
      const { service, postCommentModel } = createService(models);

      const result: any = await service.update(COMMENT_ID, {
        content: '  updated  ',
      } as any);

      expect(postCommentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        COMMENT_ID,
        expect.objectContaining({ content: 'updated' }),
        { returnDocument: 'after' },
      );
      expect(result.content).toBe('updated');
    });

    it('returns null when the comment is not found', async () => {
      const models = createModels();
      models.postCommentModel.findByIdAndUpdate.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      const result = await service.update(COMMENT_ID, {} as any);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('decrements the post comment counter when the comment existed', async () => {
      const models = createModels();
      models.postCommentModel.findByIdAndDelete.mockReturnValue(
        execResolve(buildCommentDoc()),
      );
      const { service, postModel } = createService(models);

      const result = await service.remove(COMMENT_ID);

      expect(postModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.commentsCount': -1 } },
      );
      expect(result).toEqual({ id: COMMENT_ID });
    });

    it('does nothing extra when the comment did not exist', async () => {
      const models = createModels();
      models.postCommentModel.findByIdAndDelete.mockReturnValue(execResolve(null));
      const { service, postModel } = createService(models);

      const result = await service.remove(COMMENT_ID);

      expect(postModel.updateOne).not.toHaveBeenCalled();
      expect(result).toEqual({ id: COMMENT_ID });
    });
  });

  describe('assertOwner', () => {
    it('throws NotFoundException when the comment does not exist', async () => {
      const models = createModels();
      models.postCommentModel.findById.mockReturnValue(leanExecResolve(null));
      const { service } = createService(models);

      await expect(service.assertOwner(COMMENT_ID, USER_ID)).rejects.toThrow(
        'Comment not found',
      );
    });

    it('throws ForbiddenException when the current user is not the owner', async () => {
      const models = createModels();
      models.postCommentModel.findById.mockReturnValue(
        leanExecResolve(buildCommentDoc({ userId: new Types.ObjectId() })),
      );
      const { service } = createService(models);

      await expect(service.assertOwner(COMMENT_ID, USER_ID)).rejects.toThrow(
        'You cannot edit this comment',
      );
    });

    it('resolves when the current user owns the comment', async () => {
      const models = createModels();
      models.postCommentModel.findById.mockReturnValue(
        leanExecResolve(buildCommentDoc({ userId: new Types.ObjectId(USER_ID) })),
      );
      const { service } = createService(models);

      await expect(
        service.assertOwner(COMMENT_ID, USER_ID),
      ).resolves.toBeUndefined();
    });
  });
});
