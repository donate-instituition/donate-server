import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Follow, FollowDocument } from '../follows/schemas/follow.schema';
import { FollowTargetType } from '../follows/models';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAuthorType, PostVisibility } from './models';
import { Post as PostEntity, PostDocument } from './schemas/post.schema';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(PostEntity.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Follow.name) private readonly followModel: Model<FollowDocument>,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toPostResponse(post: PostDocument | any) {
    return {
      id: post._id?.toString() ?? post.id,
      authorType: post.authorType,
      authorId: post.authorId?.toString(),
      campaignId: post.campaignId?.toString(),
      institutionId: post.institutionId?.toString(),
      content: post.content,
      media: post.media ?? [],
      visibility: post.visibility,
      stats: post.stats ?? { likesCount: 0, commentsCount: 0, sharesCount: 0 },
      createdAt: post.createdAt?.toISOString?.() ?? post.createdAt,
      updatedAt: post.updatedAt?.toISOString?.() ?? post.updatedAt,
    };
  }

  async create(createPostDto: CreatePostDto) {
    const post = await this.postModel.create({
      ...createPostDto,
      authorId: createPostDto.authorId ? this.toObjectId(createPostDto.authorId) : undefined,
      campaignId: createPostDto.campaignId ? this.toObjectId(createPostDto.campaignId) : undefined,
      institutionId: createPostDto.institutionId ? this.toObjectId(createPostDto.institutionId) : undefined,
      visibility: createPostDto.visibility ?? PostVisibility.PUBLIC,
      media: createPostDto.media ?? [],
    });

    return this.toPostResponse(post);
  }

  async findAll() {
    const posts = await this.postModel.find().sort({ createdAt: -1 }).lean().exec();
    return posts.map((post) => this.toPostResponse(post));
  }

  async feed(followerUserId?: string) {
    const follows = await this.followModel
      .find({ followerUserId: this.toObjectId(followerUserId) })
      .lean()
      .exec();

    const followedInstitutionIds = follows
      .filter((follow) => follow.targetType === FollowTargetType.INSTITUTION)
      .map((follow) => follow.targetId);
    const followedCampaignIds = follows
      .filter((follow) => follow.targetType === FollowTargetType.CAMPAIGN)
      .map((follow) => follow.targetId);

    if (followedInstitutionIds.length === 0 && followedCampaignIds.length === 0) {
      return [];
    }

    const posts = await this.postModel
      .find({
        visibility: { $in: [PostVisibility.PUBLIC, PostVisibility.FOLLOWERS_ONLY] },
        $or: [
          { institutionId: { $in: followedInstitutionIds } },
          { campaignId: { $in: followedCampaignIds } },
          { authorType: PostAuthorType.INSTITUTION, authorId: { $in: followedInstitutionIds } },
        ],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return posts.map((post) => this.toPostResponse(post));
  }

  async findOne(id: string) {
    const post = await this.postModel.findById(id).lean().exec();
    return post ? this.toPostResponse(post) : null;
  }

  async update(id: string, updatePostDto: UpdatePostDto) {
    const post = await this.postModel.findByIdAndUpdate(id, updatePostDto, { new: true }).lean().exec();
    return post ? this.toPostResponse(post) : null;
  }

  async remove(id: string) {
    await this.postModel.findByIdAndDelete(id).exec();
    return { id };
  }
}
