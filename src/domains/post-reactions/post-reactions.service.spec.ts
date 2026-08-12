import { Types } from 'mongoose';

import { PostReactionType } from './models';
import { PostReactionsService } from './post-reactions.service';

const POST_ID = new Types.ObjectId().toString();
const USER_ID = new Types.ObjectId().toString();
const REACTION_ID = new Types.ObjectId().toString();

function execResolve(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function selectLeanExecResolve(value: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(execResolve(value)),
    }),
  };
}

function buildReactionDoc(overrides: Record<string, any> = {}) {
  return {
    _id: new Types.ObjectId(REACTION_ID),
    postId: new Types.ObjectId(POST_ID),
    userId: new Types.ObjectId(USER_ID),
    type: PostReactionType.LIKE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createCountersServiceMock() {
  return {
    bufferIncrement: jest.fn().mockResolvedValue(undefined),
  };
}

function createModels() {
  const postReactionModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  const postModel = {
    exists: jest.fn(),
    updateOne: jest.fn().mockReturnValue(execResolve(undefined)),
  };

  return { postReactionModel, postModel };
}

function createService(models = createModels()) {
  const countersService = createCountersServiceMock();
  const service = new PostReactionsService(
    models.postReactionModel as any,
    models.postModel as any,
    countersService as any,
  );

  return { service, countersService, ...models };
}

describe('PostReactionsService', () => {
  describe('create', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      await expect(
        service.create({ postId: POST_ID } as any, USER_ID),
      ).rejects.toThrow('Post not found');
    });

    it('creates a LIKE reaction and buffers the likes counter', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      models.postReactionModel.findOne.mockReturnValue(execResolve(null));
      models.postReactionModel.create.mockResolvedValue(buildReactionDoc());
      const { service, postReactionModel, countersService } = createService(models);

      const result: any = await service.create(
        { postId: POST_ID, type: PostReactionType.LIKE } as any,
        USER_ID,
      );

      expect(postReactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: PostReactionType.LIKE }),
      );
      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'post',
        POST_ID,
        'likesCount',
        1,
        expect.any(Function),
      );
      expect(result.type).toBe(PostReactionType.LIKE);
    });

    it('defaults to LIKE when no type is provided', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      models.postReactionModel.findOne.mockReturnValue(execResolve(null));
      models.postReactionModel.create.mockResolvedValue(buildReactionDoc());
      const { service, postReactionModel } = createService(models);

      await service.create({ postId: POST_ID } as any, USER_ID);

      expect(postReactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: PostReactionType.LIKE }),
      );
    });

    it('returns the existing reaction unchanged when the type matches', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      const existing = buildReactionDoc();
      models.postReactionModel.findOne.mockReturnValue(execResolve(existing));
      const { service, postReactionModel } = createService(models);

      const result: any = await service.create(
        { postId: POST_ID, type: PostReactionType.LIKE } as any,
        USER_ID,
      );

      expect(existing.save).not.toHaveBeenCalled();
      expect(postReactionModel.create).not.toHaveBeenCalled();
      expect(result.id).toBe(REACTION_ID);
    });

    it('updates and saves the existing reaction when the type differs', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      const existing = buildReactionDoc({ type: 'OTHER' });
      models.postReactionModel.findOne.mockReturnValue(execResolve(existing));
      const { service } = createService(models);

      const result: any = await service.create(
        { postId: POST_ID, type: PostReactionType.LIKE } as any,
        USER_ID,
      );

      expect(existing.save).toHaveBeenCalled();
      expect(result.type).toBe(PostReactionType.LIKE);
    });
  });

  describe('getMyLikedPostIds', () => {
    it('returns the post ids the user liked', async () => {
      const models = createModels();
      models.postReactionModel.find.mockReturnValue(
        selectLeanExecResolve([{ postId: new Types.ObjectId(POST_ID) }]),
      );
      const { service } = createService(models);

      const result = await service.getMyLikedPostIds(USER_ID);

      expect(result).toEqual([POST_ID]);
    });
  });

  describe('findAll', () => {
    it('returns reactions sorted by newest first', async () => {
      const models = createModels();
      models.postReactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(execResolve([buildReactionDoc()])),
      });
      const { service } = createService(models);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns null when the reaction does not exist', async () => {
      const models = createModels();
      models.postReactionModel.findById.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      const result = await service.findOne(REACTION_ID);

      expect(result).toBeNull();
    });

    it('returns the mapped reaction when found', async () => {
      const models = createModels();
      models.postReactionModel.findById.mockReturnValue(execResolve(buildReactionDoc()));
      const { service } = createService(models);

      const result: any = await service.findOne(REACTION_ID);

      expect(result.id).toBe(REACTION_ID);
    });
  });

  describe('update', () => {
    it('returns the mapped reaction when updated', async () => {
      const models = createModels();
      models.postReactionModel.findByIdAndUpdate.mockReturnValue(
        execResolve(buildReactionDoc({ type: PostReactionType.LIKE })),
      );
      const { service, postReactionModel } = createService(models);

      const result: any = await service.update(REACTION_ID, {
        type: PostReactionType.LIKE,
      } as any);

      expect(postReactionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        REACTION_ID,
        { type: PostReactionType.LIKE },
        { returnDocument: 'after' },
      );
      expect(result.id).toBe(REACTION_ID);
    });

    it('returns null when the reaction is not found', async () => {
      const models = createModels();
      models.postReactionModel.findByIdAndUpdate.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      const result = await service.update(REACTION_ID, {} as any);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('decrements the likes counter when a LIKE reaction existed', async () => {
      const models = createModels();
      models.postReactionModel.findByIdAndDelete.mockReturnValue(
        execResolve(buildReactionDoc()),
      );
      const { service, countersService } = createService(models);

      const result = await service.remove(REACTION_ID);

      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'post',
        POST_ID,
        'likesCount',
        -1,
        expect.any(Function),
      );
      expect(result).toEqual({ id: REACTION_ID });
    });

    it('does not touch the counter when the reaction did not exist', async () => {
      const models = createModels();
      models.postReactionModel.findByIdAndDelete.mockReturnValue(execResolve(null));
      const { service, countersService } = createService(models);

      const result = await service.remove(REACTION_ID);

      expect(countersService.bufferIncrement).not.toHaveBeenCalled();
      expect(result).toEqual({ id: REACTION_ID });
    });
  });

  describe('removeMineByPost', () => {
    it('decrements the likes counter when the caller had liked the post', async () => {
      const models = createModels();
      models.postReactionModel.findOneAndDelete.mockReturnValue(
        execResolve(buildReactionDoc()),
      );
      const { service, postReactionModel, countersService } = createService(models);

      const result = await service.removeMineByPost(POST_ID, USER_ID);

      expect(postReactionModel.findOneAndDelete).toHaveBeenCalledWith({
        postId: expect.any(Types.ObjectId),
        userId: expect.any(Types.ObjectId),
      });
      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'post',
        POST_ID,
        'likesCount',
        -1,
        expect.any(Function),
      );
      expect(result).toEqual({ postId: POST_ID });
    });

    it('does not touch the counter when there was no reaction to remove', async () => {
      const models = createModels();
      models.postReactionModel.findOneAndDelete.mockReturnValue(execResolve(null));
      const { service, countersService } = createService(models);

      const result = await service.removeMineByPost(POST_ID, USER_ID);

      expect(countersService.bufferIncrement).not.toHaveBeenCalled();
      expect(result).toEqual({ postId: POST_ID });
    });
  });
});
