import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Campaign,
  CampaignDocument,
} from '../campaigns/schemas/campaign.schema';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateFollowDto } from './dto/create-follow.dto';
import { UpdateFollowDto } from './dto/update-follow.dto';
import { FollowTargetType } from './models';
import { Follow, FollowDocument } from './schemas/follow.schema';

@Injectable()
export class FollowsService {
  constructor(
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toFollowResponse(follow: FollowDocument | Follow) {
    return {
      id: follow._id?.toString(),
      followerUserId: follow.followerUserId?.toString(),
      targetType: follow.targetType,
      targetId: follow.targetId?.toString(),
      createdAt: follow.createdAt?.toISOString?.() ?? follow.createdAt,
    };
  }

  private assertTargetType(targetType?: FollowTargetType) {
    if (!targetType || !Object.values(FollowTargetType).includes(targetType)) {
      throw new BadRequestException('Invalid targetType');
    }

    return targetType;
  }

  private async assertTargetExists(
    targetType: FollowTargetType,
    targetId: Types.ObjectId,
  ) {
    if (targetType === FollowTargetType.CAMPAIGN) {
      const exists = await this.campaignModel.exists({ _id: targetId }).exec();
      if (!exists) throw new NotFoundException('Campaign not found');
      return;
    }

    if (targetType === FollowTargetType.INSTITUTION) {
      const exists = await this.institutionModel
        .exists({ _id: targetId })
        .exec();
      if (!exists) throw new NotFoundException('Institution not found');
      return;
    }

    const exists = await this.userModel.exists({ _id: targetId }).exec();
    if (!exists) throw new NotFoundException('User not found');
  }

  private async incrementStats(
    followerUserId: Types.ObjectId,
    targetType: FollowTargetType,
    targetId: Types.ObjectId,
    delta: 1 | -1,
  ) {
    if (targetType === FollowTargetType.CAMPAIGN) {
      await Promise.all([
        this.campaignModel
          .updateOne(
            { _id: targetId },
            { $inc: { 'stats.followersCount': delta } },
          )
          .exec(),
        this.userModel
          .updateOne(
            { _id: followerUserId },
            { $inc: { 'stats.followingCampaignsCount': delta } },
          )
          .exec(),
      ]);
      return;
    }

    if (targetType === FollowTargetType.INSTITUTION) {
      await Promise.all([
        this.institutionModel
          .updateOne(
            { _id: targetId },
            { $inc: { 'stats.followersCount': delta } },
          )
          .exec(),
        this.userModel
          .updateOne(
            { _id: followerUserId },
            { $inc: { 'stats.followingInstitutionsCount': delta } },
          )
          .exec(),
      ]);
      return;
    }

    await Promise.all([
      this.userModel
        .updateOne(
          { _id: followerUserId },
          { $inc: { 'stats.followingUsersCount': delta } },
        )
        .exec(),
      this.userModel
        .updateOne(
          { _id: targetId },
          { $inc: { 'stats.followersCount': delta } },
        )
        .exec(),
    ]);
  }

  async create(createFollowDto: CreateFollowDto, followerUserId?: string) {
    const ownerId = this.toObjectId(followerUserId);
    const targetType = this.assertTargetType(createFollowDto.targetType);
    const targetId = this.toObjectId(createFollowDto.targetId);

    if (
      targetType === FollowTargetType.USER &&
      ownerId.toString() === targetId.toString()
    ) {
      throw new BadRequestException('You cannot follow yourself');
    }

    await this.assertTargetExists(targetType, targetId);

    const existing = await this.followModel
      .findOne({
        followerUserId: ownerId,
        targetType,
        targetId,
      })
      .exec();

    if (existing) {
      return this.toFollowResponse(existing);
    }

    const follow = await this.followModel.create({
      followerUserId: ownerId,
      targetType,
      targetId,
    });

    await this.incrementStats(ownerId, targetType, targetId, 1);

    return this.toFollowResponse(follow);
  }

  async findAll() {
    const follows = await this.followModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return follows.map((follow) => this.toFollowResponse(follow));
  }

  async findMine(followerUserId?: string) {
    const follows = await this.followModel
      .find({ followerUserId: this.toObjectId(followerUserId) })
      .sort({ createdAt: -1 })
      .exec();

    return follows.map((follow) => this.toFollowResponse(follow));
  }

  async findOne(id: string) {
    const follow = await this.followModel.findById(id).exec();
    return follow ? this.toFollowResponse(follow) : null;
  }

  async update(id: string, updateFollowDto: UpdateFollowDto) {
    const follow = await this.followModel
      .findByIdAndUpdate(id, updateFollowDto, { new: true })
      .exec();

    return follow ? this.toFollowResponse(follow) : null;
  }

  async remove(id: string) {
    const follow = await this.followModel.findByIdAndDelete(id).exec();

    if (follow) {
      await this.incrementStats(
        follow.followerUserId,
        follow.targetType,
        follow.targetId,
        -1,
      );
    }

    return { id };
  }

  async removeByTarget(
    targetType: string,
    targetId: string,
    followerUserId?: string,
  ) {
    const parsedTargetType = this.assertTargetType(
      targetType as FollowTargetType,
    );
    const parsedTargetId = this.toObjectId(targetId);
    const ownerId = this.toObjectId(followerUserId);
    const follow = await this.followModel
      .findOneAndDelete({
        followerUserId: ownerId,
        targetType: parsedTargetType,
        targetId: parsedTargetId,
      })
      .exec();

    if (follow) {
      await this.incrementStats(ownerId, parsedTargetType, parsedTargetId, -1);
    }

    return { targetType, targetId };
  }
}
