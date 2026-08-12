import { Types } from 'mongoose';

import { PostAuthorType, PostVisibility } from './models';
import { PostsService } from './posts.service';

const USER_ID = new Types.ObjectId().toString();
const INSTITUTION_ID = new Types.ObjectId().toString();
const CAMPAIGN_ID = new Types.ObjectId().toString();
const POST_ID = new Types.ObjectId().toString();

function currentUser(overrides: Partial<{ sub: string }> = {}) {
  return {
    sub: USER_ID,
    email: 'user@example.com',
    roles: [],
    type: 'DONOR',
    status: 'ACTIVE',
    ...overrides,
  } as any;
}

function execResolve(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function leanExecResolve(value: unknown) {
  return { lean: jest.fn().mockReturnValue(execResolve(value)) };
}

function selectLeanExecResolve(value: unknown) {
  return { select: jest.fn().mockReturnValue(leanExecResolve(value)) };
}

function findChainResolve(value: unknown) {
  return {
    sort: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue(execResolve(value)),
      }),
    }),
  };
}

function buildPostDoc(overrides: Record<string, any> = {}) {
  return {
    _id: new Types.ObjectId(POST_ID),
    authorType: PostAuthorType.USER,
    authorId: new Types.ObjectId(USER_ID),
    content: 'hello world',
    media: [],
    visibility: PostVisibility.PUBLIC,
    stats: { likesCount: 0, commentsCount: 0, sharesCount: 0 },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createRedisServiceMock() {
  return {
    cacheAside: jest.fn((_key: string, _ttl: number, loader: () => unknown) =>
      loader(),
    ),
    del: jest.fn().mockResolvedValue(0),
    increment: jest.fn().mockResolvedValue(1),
  };
}

function createCountersServiceMock() {
  return {
    bufferIncrement: jest.fn().mockResolvedValue(undefined),
    getPendingDelta: jest.fn().mockResolvedValue({
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    }),
    getPendingDeltas: jest.fn().mockResolvedValue(new Map()),
  };
}

function createModels() {
  const postModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn().mockReturnValue(execResolve(undefined)),
  };

  const followModel = {
    find: jest.fn(),
    exists: jest.fn(),
  };

  const campaignModel = {
    findById: jest.fn(),
    updateOne: jest.fn().mockReturnValue(execResolve(undefined)),
  };

  const institutionModel = {
    exists: jest.fn(),
    updateOne: jest.fn().mockReturnValue(execResolve(undefined)),
  };

  const staffMembershipModel = {
    findOne: jest.fn(),
  };

  return {
    postModel,
    followModel,
    campaignModel,
    institutionModel,
    staffMembershipModel,
  };
}

function createService(models = createModels()) {
  const redisService = createRedisServiceMock();
  const countersService = createCountersServiceMock();
  const service = new PostsService(
    models.postModel as any,
    models.followModel as any,
    models.campaignModel as any,
    models.institutionModel as any,
    models.staffMembershipModel as any,
    redisService as any,
    countersService as any,
  );

  return { service, ...models, redisService, countersService };
}

describe('PostsService', () => {
  describe('create', () => {
    it('throws when there is no authenticated user', async () => {
      const { service } = createService();

      await expect(
        service.create({ content: 'hi' } as any, undefined),
      ).rejects.toThrow('Authenticated user is required');
    });

    it('throws when content is blank', async () => {
      const { service } = createService();

      await expect(
        service.create({ content: '   ' } as any, currentUser()),
      ).rejects.toThrow('Post content is required');
    });

    it('creates a USER post with no campaign/institution targets', async () => {
      const models = createModels();
      models.postModel.create.mockImplementation(async (input: any) =>
        buildPostDoc(input),
      );
      const { service, postModel, institutionModel, campaignModel } =
        createService(models);

      const result = await service.create(
        { content: '  hello  ', authorType: PostAuthorType.USER } as any,
        currentUser(),
      );

      expect(postModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorType: PostAuthorType.USER,
          content: 'hello',
          visibility: PostVisibility.PUBLIC,
        }),
      );
      expect(institutionModel.updateOne).not.toHaveBeenCalled();
      expect(campaignModel.updateOne).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ content: 'hello', authorType: 'USER' }),
      );
    });

    it('throws NotFoundException when institutionId does not exist', async () => {
      const models = createModels();
      models.institutionModel.exists.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      await expect(
        service.create(
          { content: 'hi', institutionId: INSTITUTION_ID } as any,
          currentUser(),
        ),
      ).rejects.toThrow('Institution not found');
    });

    it('throws NotFoundException when campaignId does not exist', async () => {
      const models = createModels();
      models.campaignModel.findById.mockReturnValue(selectLeanExecResolve(null));
      const { service } = createService(models);

      await expect(
        service.create(
          { content: 'hi', campaignId: CAMPAIGN_ID } as any,
          currentUser(),
        ),
      ).rejects.toThrow('Campaign not found');
    });

    it('throws BadRequestException when campaign does not belong to institution', async () => {
      const models = createModels();
      models.institutionModel.exists.mockReturnValue(execResolve({ _id: INSTITUTION_ID }));
      models.campaignModel.findById.mockReturnValue(
        selectLeanExecResolve({ institutionId: new Types.ObjectId() }),
      );
      const { service } = createService(models);

      await expect(
        service.create(
          {
            content: 'hi',
            institutionId: INSTITUTION_ID,
            campaignId: CAMPAIGN_ID,
          } as any,
          currentUser(),
        ),
      ).rejects.toThrow('Campaign does not belong to institution');
    });

    it('throws BadRequestException when authorType is INSTITUTION without institutionId', async () => {
      const { service } = createService();

      await expect(
        service.create(
          { content: 'hi', authorType: PostAuthorType.INSTITUTION } as any,
          currentUser(),
        ),
      ).rejects.toThrow('institutionId is required');
    });

    it('throws ForbiddenException when posting as institution without active staff membership', async () => {
      const models = createModels();
      models.institutionModel.exists.mockReturnValue(execResolve({ _id: INSTITUTION_ID }));
      models.staffMembershipModel.findOne.mockReturnValue(leanExecResolve(null));
      const { service } = createService(models);

      await expect(
        service.create(
          {
            content: 'hi',
            authorType: PostAuthorType.INSTITUTION,
            institutionId: INSTITUTION_ID,
          } as any,
          currentUser(),
        ),
      ).rejects.toThrow('Only active institution staff can post');
    });

    it('creates an INSTITUTION post and increments institution + campaign counters', async () => {
      const models = createModels();
      models.institutionModel.exists.mockReturnValue(execResolve({ _id: INSTITUTION_ID }));
      models.campaignModel.findById.mockReturnValue(
        selectLeanExecResolve({ institutionId: new Types.ObjectId(INSTITUTION_ID) }),
      );
      models.staffMembershipModel.findOne.mockReturnValue(
        leanExecResolve({ status: 'ACTIVE' }),
      );
      models.postModel.create.mockImplementation(async (input: any) =>
        buildPostDoc({
          ...input,
          institutionId: new Types.ObjectId(INSTITUTION_ID),
          campaignId: new Types.ObjectId(CAMPAIGN_ID),
        }),
      );
      const { service, postModel, institutionModel, campaignModel, redisService } =
        createService(models);

      const result = await service.create(
        {
          content: 'hi',
          authorType: PostAuthorType.INSTITUTION,
          institutionId: INSTITUTION_ID,
          campaignId: CAMPAIGN_ID,
        } as any,
        currentUser(),
      );

      expect(postModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorType: PostAuthorType.INSTITUTION }),
      );
      expect(institutionModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.postsCount': 1 } },
      );
      expect(campaignModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.postsCount': 1 } },
      );
      expect(redisService.del).toHaveBeenCalled();
      expect(redisService.increment).toHaveBeenCalledWith('cache:version:campaigns');
      expect(result.authorId).toBe(INSTITUTION_ID);
    });
  });

  describe('findAll', () => {
    it('returns a plain array when not paginated', async () => {
      const models = createModels();
      models.postModel.find.mockReturnValue(findChainResolve([buildPostDoc()]));
      const { service, postModel } = createService(models);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[])[0]).toEqual(
        expect.objectContaining({ id: POST_ID }),
      );
      expect(postModel.countDocuments).not.toHaveBeenCalled();
    });

    it('applies a search filter and returns paginated meta', async () => {
      const models = createModels();
      models.postModel.find.mockReturnValue(findChainResolve([buildPostDoc()]));
      models.postModel.countDocuments.mockReturnValue(execResolve(1));
      const { service, postModel } = createService(models);

      const result: any = await service.findAll({ page: '1', search: 'hello' });

      expect(postModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { $regex: 'hello', $options: 'i' },
        }),
      );
      expect(result.meta).toEqual(
        expect.objectContaining({ total: 1, page: 1 }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('feed', () => {
    it('builds a visibility filter from the user follows (unpaginated)', async () => {
      const models = createModels();
      models.followModel.find.mockReturnValue(
        leanExecResolve([
          { targetType: 'INSTITUTION', targetId: new Types.ObjectId(INSTITUTION_ID) },
          { targetType: 'CAMPAIGN', targetId: new Types.ObjectId(CAMPAIGN_ID) },
          { targetType: 'USER', targetId: new Types.ObjectId(USER_ID) },
        ]),
      );
      models.postModel.find.mockReturnValue(findChainResolve([buildPostDoc()]));
      const { service, postModel, redisService } = createService(models);

      const result = await service.feed(USER_ID);

      expect(redisService.cacheAside).toHaveBeenCalled();
      expect(postModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { visibility: PostVisibility.PUBLIC },
          ]),
        }),
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns paginated feed results when pagination is requested', async () => {
      const models = createModels();
      models.followModel.find.mockReturnValue(leanExecResolve([]));
      models.postModel.find.mockReturnValue(findChainResolve([buildPostDoc()]));
      models.postModel.countDocuments.mockReturnValue(execResolve(1));
      const { service } = createService(models);

      const result: any = await service.feed(USER_ID, { page: '1' });

      expect(result.meta).toBeDefined();
      expect(result.items).toHaveLength(1);
    });

    it('throws when followerUserId is invalid', async () => {
      const models = createModels();
      models.followModel.find.mockReturnValue(leanExecResolve([]));
      const { service } = createService(models);

      await expect(service.feed('not-an-id')).rejects.toThrow('Invalid id');
    });
  });

  describe('findOne', () => {
    it('returns null when the post does not exist', async () => {
      const models = createModels();
      models.postModel.findById.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      const result = await service.findOne(POST_ID);

      expect(result).toBeNull();
    });

    it('returns a public post without checking follows', async () => {
      const models = createModels();
      models.postModel.findById.mockReturnValue(execResolve(buildPostDoc()));
      const { service, followModel } = createService(models);

      const result: any = await service.findOne(POST_ID);

      expect(result.id).toBe(POST_ID);
      expect(followModel.exists).not.toHaveBeenCalled();
    });

    it('returns a followers-only post when the viewer follows the author', async () => {
      const models = createModels();
      models.postModel.findById.mockReturnValue(
        execResolve(buildPostDoc({ visibility: PostVisibility.FOLLOWERS_ONLY })),
      );
      models.followModel.exists.mockReturnValue(execResolve({ _id: 'follow-1' }));
      const { service } = createService(models);

      const result: any = await service.findOne(POST_ID, USER_ID);

      expect(result.id).toBe(POST_ID);
    });

    it('throws ForbiddenException for a followers-only post when the viewer does not follow', async () => {
      const models = createModels();
      models.postModel.findById.mockReturnValue(
        execResolve(buildPostDoc({ visibility: PostVisibility.FOLLOWERS_ONLY })),
      );
      models.followModel.exists.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      await expect(service.findOne(POST_ID, USER_ID)).rejects.toThrow(
        'You cannot view this post',
      );
    });
  });

  describe('update', () => {
    it('trims content and returns the merged response', async () => {
      const models = createModels();
      models.postModel.findByIdAndUpdate.mockReturnValue(
        execResolve(buildPostDoc({ content: 'updated' })),
      );
      const { service, postModel } = createService(models);

      const result: any = await service.update(POST_ID, { content: '  updated  ' } as any);

      expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith(
        POST_ID,
        expect.objectContaining({ content: 'updated' }),
        { returnDocument: 'after' },
      );
      expect(result.content).toBe('updated');
    });

    it('returns null when the post is not found', async () => {
      const models = createModels();
      models.postModel.findByIdAndUpdate.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      const result = await service.update(POST_ID, {} as any);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('decrements counters when the post existed', async () => {
      const models = createModels();
      models.postModel.findByIdAndDelete.mockReturnValue(
        execResolve(buildPostDoc({ institutionId: new Types.ObjectId(INSTITUTION_ID) })),
      );
      const { service, institutionModel } = createService(models);

      const result = await service.remove(POST_ID);

      expect(institutionModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.postsCount': -1 } },
      );
      expect(result).toEqual({ id: POST_ID });
    });

    it('does nothing extra when the post did not exist', async () => {
      const models = createModels();
      models.postModel.findByIdAndDelete.mockReturnValue(execResolve(null));
      const { service, institutionModel } = createService(models);

      const result = await service.remove(POST_ID);

      expect(institutionModel.updateOne).not.toHaveBeenCalled();
      expect(result).toEqual({ id: POST_ID });
    });
  });

  describe('share', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve(null));
      const { service } = createService(models);

      await expect(service.share(POST_ID)).rejects.toThrow('Post not found');
    });

    it('buffers a share increment and returns the merged count', async () => {
      const models = createModels();
      models.postModel.exists.mockReturnValue(execResolve({ _id: POST_ID }));
      models.postModel.findById.mockReturnValue(
        selectLeanExecResolve({ stats: { sharesCount: 2 } }),
      );
      const { service, countersService } = createService(models);
      countersService.getPendingDelta.mockResolvedValue({
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 3,
      });

      const result = await service.share(POST_ID);

      expect(countersService.bufferIncrement).toHaveBeenCalledWith(
        'post',
        POST_ID,
        'sharesCount',
        1,
        expect.any(Function),
      );
      expect(result).toEqual({ postId: POST_ID, sharesCount: 5 });
    });
  });
});
