import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateFollowDto } from './dto/create-follow.dto';
import { UpdateFollowDto } from './dto/update-follow.dto';
import { FollowTargetType } from './models';
import { Follow, FollowDocument } from './schemas/follow.schema';

@Injectable()
export class FollowsService {
  constructor(
    @InjectModel(Follow.name) private readonly followModel: Model<FollowDocument>,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toFollowResponse(follow: FollowDocument | any) {
    return {
      id: follow._id?.toString() ?? follow.id,
      followerUserId: follow.followerUserId?.toString(),
      targetType: follow.targetType,
      targetId: follow.targetId?.toString(),
      createdAt: follow.createdAt?.toISOString?.() ?? follow.createdAt,
    };
  }

  async create(createFollowDto: CreateFollowDto, followerUserId?: string) {
    const ownerId = this.toObjectId(followerUserId);
    const targetId = this.toObjectId(createFollowDto.targetId);

    const follow = await this.followModel
      .findOneAndUpdate(
        {
          followerUserId: ownerId,
          targetType: createFollowDto.targetType,
          targetId,
        },
        {
          followerUserId: ownerId,
          targetType: createFollowDto.targetType,
          targetId,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    return this.toFollowResponse(follow);
  }

  async findAll() {
    const follows = await this.followModel.find().sort({ createdAt: -1 }).lean().exec();
    return follows.map((follow) => this.toFollowResponse(follow));
  }

  async findMine(followerUserId?: string) {
    const follows = await this.followModel
      .find({ followerUserId: this.toObjectId(followerUserId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return follows.map((follow) => this.toFollowResponse(follow));
  }

  async findOne(id: string) {
    const follow = await this.followModel.findById(id).lean().exec();
    return follow ? this.toFollowResponse(follow) : null;
  }

  async update(id: string, updateFollowDto: UpdateFollowDto) {
    const follow = await this.followModel.findByIdAndUpdate(id, updateFollowDto, { new: true }).lean().exec();
    return follow ? this.toFollowResponse(follow) : null;
  }

  async remove(id: string) {
    await this.followModel.findByIdAndDelete(id).exec();
    return { id };
  }

  async removeByTarget(targetType: string, targetId: string, followerUserId?: string) {
    const parsedTargetType = targetType as FollowTargetType;

    if (!Object.values(FollowTargetType).includes(parsedTargetType)) {
      throw new BadRequestException('Invalid targetType');
    }

    await this.followModel
      .findOneAndDelete({
        followerUserId: this.toObjectId(followerUserId),
        targetType: parsedTargetType,
        targetId: this.toObjectId(targetId),
      })
      .exec();

    return { targetType, targetId };
  }
}
