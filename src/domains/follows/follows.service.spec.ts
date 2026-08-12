import { Types } from 'mongoose';

import { FollowTargetType } from './models';
import { FollowsService } from './follows.service';

const FOLLOWER_ID = '507f1f77bcf86cd799439011';
const CAMPAIGN_ID = '507f1f77bcf86cd799439022';
const INSTITUTION_ID = '507f1f77bcf86cd799439033';
const USER_TARGET_ID = '507f1f77bcf86cd799439044';
const FOLLOW_ID = '507f1f77bcf86cd799439055';

function createFollowModelMock() {
  return {
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    create: jest.fn().mockResolvedValue({
      _id: FOLLOW_ID,
      followerUserId: new Types.ObjectId(FOLLOWER_ID),
      targetType: FollowTargetType.CAMPAIGN,
      targetId: new Types.ObjectId(CAMPAIGN_ID),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    }),
    findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    findByIdAndUpdate: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    findByIdAndDelete: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    findOneAndDelete: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  };
}

function createCampaignModelMock(exists = true) {
  return {
    exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(exists) }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

function createInstitutionModelMock(exists = true) {
  return {
    exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(exists) }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

function createUserModelMock(exists = true) {
  return {
    exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(exists) }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

describe('FollowsService', () => {
  function createService({
    followModel = createFollowModelMock(),
    campaignModel = createCampaignModelMock(),
    institutionModel = createInstitutionModelMock(),
    userModel = createUserModelMock(),
  }: {
    followModel?: ReturnType<typeof createFollowModelMock>;
    campaignModel?: ReturnType<typeof createCampaignModelMock>;
    institutionModel?: ReturnType<typeof createInstitutionModelMock>;
    userModel?: ReturnType<typeof createUserModelMock>;
  } = {}) {
    const service = new FollowsService(
      followModel as any,
      campaignModel as any,
      institutionModel as any,
      userModel as any,
    );

    return { service, followModel, campaignModel, institutionModel, userModel };
  }

  describe('create', () => {
    it('rejects an invalid follower id', async () => {
      const { service } = createService();

      await expect(
        service.create(
          { targetType: FollowTargetType.CAMPAIGN, targetId: CAMPAIGN_ID },
          undefined,
        ),
      ).rejects.toThrow('Invalid id');
    });

    it('rejects an invalid targetType', async () => {
      const { service } = createService();

      await expect(
        service.create(
          { targetType: 'BOGUS' as FollowTargetType, targetId: CAMPAIGN_ID },
          FOLLOWER_ID,
        ),
      ).rejects.toThrow('Invalid targetType');
    });

    it('rejects an invalid targetId', async () => {
      const { service } = createService();

      await expect(
        service.create(
          { targetType: FollowTargetType.CAMPAIGN, targetId: 'not-an-id' },
          FOLLOWER_ID,
        ),
      ).rejects.toThrow('Invalid id');
    });

    it('rejects a user following themselves', async () => {
      const { service } = createService();

      await expect(
        service.create(
          { targetType: FollowTargetType.USER, targetId: FOLLOWER_ID },
          FOLLOWER_ID,
        ),
      ).rejects.toThrow('You cannot follow yourself');
    });

    it('throws NotFoundException when the campaign target does not exist', async () => {
      const campaignModel = createCampaignModelMock(false);
      const { service } = createService({ campaignModel });

      await expect(
        service.create(
          { targetType: FollowTargetType.CAMPAIGN, targetId: CAMPAIGN_ID },
          FOLLOWER_ID,
        ),
      ).rejects.toThrow('Campaign not found');
    });

    it('throws NotFoundException when the institution target does not exist', async () => {
      const institutionModel = createInstitutionModelMock(false);
      const { service } = createService({ institutionModel });

      await expect(
        service.create(
          { targetType: FollowTargetType.INSTITUTION, targetId: INSTITUTION_ID },
          FOLLOWER_ID,
        ),
      ).rejects.toThrow('Institution not found');
    });

    it('throws NotFoundException when the user target does not exist', async () => {
      const userModel = createUserModelMock(false);
      const { service } = createService({ userModel });

      await expect(
        service.create(
          { targetType: FollowTargetType.USER, targetId: USER_TARGET_ID },
          FOLLOWER_ID,
        ),
      ).rejects.toThrow('User not found');
    });

    it('creates a campaign follow and increments stats', async () => {
      const followModel = createFollowModelMock();
      const campaignModel = createCampaignModelMock();
      const userModel = createUserModelMock();
      const { service } = createService({ followModel, campaignModel, userModel });

      const result = await service.create(
        { targetType: FollowTargetType.CAMPAIGN, targetId: CAMPAIGN_ID },
        FOLLOWER_ID,
      );

      expect(followModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: FollowTargetType.CAMPAIGN }),
      );
      expect(campaignModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followersCount': 1 } },
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followingCampaignsCount': 1 } },
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: FOLLOW_ID,
          followerUserId: FOLLOWER_ID,
          targetType: FollowTargetType.CAMPAIGN,
          targetId: CAMPAIGN_ID,
        }),
      );
    });

    it('creates an institution follow and increments the institution + user stats', async () => {
      const followModel = createFollowModelMock();
      followModel.create.mockResolvedValue({
        _id: FOLLOW_ID,
        followerUserId: new Types.ObjectId(FOLLOWER_ID),
        targetType: FollowTargetType.INSTITUTION,
        targetId: new Types.ObjectId(INSTITUTION_ID),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const institutionModel = createInstitutionModelMock();
      const userModel = createUserModelMock();
      const { service } = createService({ followModel, institutionModel, userModel });

      await service.create(
        { targetType: FollowTargetType.INSTITUTION, targetId: INSTITUTION_ID },
        FOLLOWER_ID,
      );

      expect(institutionModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followersCount': 1 } },
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followingInstitutionsCount': 1 } },
      );
    });

    it('creates a user follow and increments both users stats', async () => {
      const followModel = createFollowModelMock();
      followModel.create.mockResolvedValue({
        _id: FOLLOW_ID,
        followerUserId: new Types.ObjectId(FOLLOWER_ID),
        targetType: FollowTargetType.USER,
        targetId: new Types.ObjectId(USER_TARGET_ID),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const userModel = createUserModelMock();
      const { service } = createService({ followModel, userModel });

      await service.create(
        { targetType: FollowTargetType.USER, targetId: USER_TARGET_ID },
        FOLLOWER_ID,
      );

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followingUsersCount': 1 } },
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followersCount': 1 } },
      );
    });

    it('returns the existing follow without incrementing stats again on duplicate follow', async () => {
      const followModel = createFollowModelMock();
      const existingFollow = {
        _id: FOLLOW_ID,
        followerUserId: new Types.ObjectId(FOLLOWER_ID),
        targetType: FollowTargetType.CAMPAIGN,
        targetId: new Types.ObjectId(CAMPAIGN_ID),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      followModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingFollow),
      });
      const campaignModel = createCampaignModelMock();
      const { service } = createService({ followModel, campaignModel });

      const result = await service.create(
        { targetType: FollowTargetType.CAMPAIGN, targetId: CAMPAIGN_ID },
        FOLLOWER_ID,
      );

      expect(followModel.create).not.toHaveBeenCalled();
      expect(campaignModel.updateOne).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ id: FOLLOW_ID, targetType: FollowTargetType.CAMPAIGN }),
      );
    });
  });

  describe('findAll', () => {
    it('returns all follows mapped to the response shape', async () => {
      const followModel = createFollowModelMock();
      followModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              _id: FOLLOW_ID,
              followerUserId: new Types.ObjectId(FOLLOWER_ID),
              targetType: FollowTargetType.CAMPAIGN,
              targetId: new Types.ObjectId(CAMPAIGN_ID),
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ]),
        }),
      });
      const { service } = createService({ followModel });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ id: FOLLOW_ID, followerUserId: FOLLOWER_ID }),
      );
    });
  });

  describe('findMine', () => {
    it('rejects an invalid follower id', async () => {
      const { service } = createService();

      await expect(service.findMine(undefined)).rejects.toThrow('Invalid id');
    });

    it('returns only the current user follows', async () => {
      const followModel = createFollowModelMock();
      const execMock = jest.fn().mockResolvedValue([]);
      const sortMock = jest.fn().mockReturnValue({ exec: execMock });
      followModel.find.mockReturnValue({ sort: sortMock });
      const { service } = createService({ followModel });

      await service.findMine(FOLLOWER_ID);

      expect(followModel.find).toHaveBeenCalledWith({
        followerUserId: expect.any(Types.ObjectId),
      });
    });
  });

  describe('findOne', () => {
    it('returns null when no follow is found', async () => {
      const { service } = createService();

      const result = await service.findOne(FOLLOW_ID);

      expect(result).toBeNull();
    });

    it('returns the mapped follow when found', async () => {
      const followModel = createFollowModelMock();
      followModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: FOLLOW_ID,
          followerUserId: new Types.ObjectId(FOLLOWER_ID),
          targetType: FollowTargetType.CAMPAIGN,
          targetId: new Types.ObjectId(CAMPAIGN_ID),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      });
      const { service } = createService({ followModel });

      const result = await service.findOne(FOLLOW_ID);

      expect(result).toEqual(expect.objectContaining({ id: FOLLOW_ID }));
    });
  });

  describe('update', () => {
    it('returns null when no follow is found', async () => {
      const { service } = createService();

      const result = await service.update(FOLLOW_ID, {});

      expect(result).toBeNull();
    });

    it('returns the updated follow', async () => {
      const followModel = createFollowModelMock();
      followModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: FOLLOW_ID,
          followerUserId: new Types.ObjectId(FOLLOWER_ID),
          targetType: FollowTargetType.CAMPAIGN,
          targetId: new Types.ObjectId(CAMPAIGN_ID),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      });
      const { service } = createService({ followModel });

      const result = await service.update(FOLLOW_ID, {});

      expect(result).toEqual(expect.objectContaining({ id: FOLLOW_ID }));
    });
  });

  describe('remove', () => {
    it('returns the id without decrementing stats when nothing was deleted', async () => {
      const followModel = createFollowModelMock();
      const campaignModel = createCampaignModelMock();
      const { service } = createService({ followModel, campaignModel });

      const result = await service.remove(FOLLOW_ID);

      expect(result).toEqual({ id: FOLLOW_ID });
      expect(campaignModel.updateOne).not.toHaveBeenCalled();
    });

    it('decrements stats when a follow is deleted', async () => {
      const followModel = createFollowModelMock();
      followModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: FOLLOW_ID,
          followerUserId: new Types.ObjectId(FOLLOWER_ID),
          targetType: FollowTargetType.CAMPAIGN,
          targetId: new Types.ObjectId(CAMPAIGN_ID),
        }),
      });
      const campaignModel = createCampaignModelMock();
      const userModel = createUserModelMock();
      const { service } = createService({ followModel, campaignModel, userModel });

      const result = await service.remove(FOLLOW_ID);

      expect(result).toEqual({ id: FOLLOW_ID });
      expect(campaignModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followersCount': -1 } },
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followingCampaignsCount': -1 } },
      );
    });
  });

  describe('removeByTarget', () => {
    it('rejects an invalid targetType', async () => {
      const { service } = createService();

      await expect(
        service.removeByTarget('BOGUS', CAMPAIGN_ID, FOLLOWER_ID),
      ).rejects.toThrow('Invalid targetType');
    });

    it('rejects an invalid targetId', async () => {
      const { service } = createService();

      await expect(
        service.removeByTarget(FollowTargetType.CAMPAIGN, 'not-an-id', FOLLOWER_ID),
      ).rejects.toThrow('Invalid id');
    });

    it('rejects an invalid follower id', async () => {
      const { service } = createService();

      await expect(
        service.removeByTarget(FollowTargetType.CAMPAIGN, CAMPAIGN_ID, undefined),
      ).rejects.toThrow('Invalid id');
    });

    it('returns the target descriptor without decrementing when nothing matched', async () => {
      const followModel = createFollowModelMock();
      const institutionModel = createInstitutionModelMock();
      const { service } = createService({ followModel, institutionModel });

      const result = await service.removeByTarget(
        FollowTargetType.INSTITUTION,
        INSTITUTION_ID,
        FOLLOWER_ID,
      );

      expect(result).toEqual({
        targetType: FollowTargetType.INSTITUTION,
        targetId: INSTITUTION_ID,
      });
      expect(institutionModel.updateOne).not.toHaveBeenCalled();
    });

    it('unfollows an institution and decrements stats', async () => {
      const followModel = createFollowModelMock();
      followModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: FOLLOW_ID,
          followerUserId: new Types.ObjectId(FOLLOWER_ID),
          targetType: FollowTargetType.INSTITUTION,
          targetId: new Types.ObjectId(INSTITUTION_ID),
        }),
      });
      const institutionModel = createInstitutionModelMock();
      const userModel = createUserModelMock();
      const { service } = createService({ followModel, institutionModel, userModel });

      const result = await service.removeByTarget(
        FollowTargetType.INSTITUTION,
        INSTITUTION_ID,
        FOLLOWER_ID,
      );

      expect(result).toEqual({
        targetType: FollowTargetType.INSTITUTION,
        targetId: INSTITUTION_ID,
      });
      expect(institutionModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followersCount': -1 } },
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followingInstitutionsCount': -1 } },
      );
    });

    it('unfollows a campaign and decrements stats', async () => {
      const followModel = createFollowModelMock();
      followModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: FOLLOW_ID,
          followerUserId: new Types.ObjectId(FOLLOWER_ID),
          targetType: FollowTargetType.CAMPAIGN,
          targetId: new Types.ObjectId(CAMPAIGN_ID),
        }),
      });
      const campaignModel = createCampaignModelMock();
      const { service } = createService({ followModel, campaignModel });

      const result = await service.removeByTarget(
        FollowTargetType.CAMPAIGN,
        CAMPAIGN_ID,
        FOLLOWER_ID,
      );

      expect(result).toEqual({
        targetType: FollowTargetType.CAMPAIGN,
        targetId: CAMPAIGN_ID,
      });
      expect(campaignModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { 'stats.followersCount': -1 } },
      );
    });
  });
});
