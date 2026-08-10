import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  getPaginationOptions,
  paginatedResponse,
  type PaginationQuery,
  shouldPaginate,
} from '../../common/pagination';
import {
  Campaign,
  CampaignDocument,
} from '../campaigns/schemas/campaign.schema';
import { FollowTargetType } from '../follows/models';
import { Follow, FollowDocument } from '../follows/schemas/follow.schema';
import { InstitutionStaffMembershipStatus } from '../institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAuthorType, PostVisibility } from './models';
import { Post as PostEntity, PostDocument } from './schemas/post.schema';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(PostEntity.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly staffMembershipModel: Model<InstitutionStaffMembershipDocument>,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private requireCurrentUser(currentUser?: AuthenticatedUser) {
    if (!currentUser) {
      throw new ForbiddenException('Authenticated user is required');
    }

    return currentUser;
  }

  private toPostResponse(post: PostDocument | PostEntity) {
    return {
      id: post._id?.toString(),
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

  private async assertCanPostAsInstitution(
    institutionId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    const membership = await this.staffMembershipModel
      .findOne({
        institutionId,
        userId,
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .lean()
      .exec();

    if (!membership) {
      throw new ForbiddenException('Only active institution staff can post');
    }
  }

  private async assertPostTargets(input: {
    campaignId?: Types.ObjectId;
    institutionId?: Types.ObjectId;
  }) {
    if (input.institutionId) {
      const institutionExists = await this.institutionModel
        .exists({ _id: input.institutionId })
        .exec();
      if (!institutionExists)
        throw new NotFoundException('Institution not found');
    }

    if (input.campaignId) {
      const campaign = await this.campaignModel
        .findById(input.campaignId)
        .select('institutionId')
        .lean()
        .exec();

      if (!campaign) throw new NotFoundException('Campaign not found');

      if (
        input.institutionId &&
        campaign.institutionId.toString() !== input.institutionId.toString()
      ) {
        throw new BadRequestException(
          'Campaign does not belong to institution',
        );
      }
    }
  }

  private async incrementPostCounters(
    post: PostDocument | PostEntity,
    delta: 1 | -1,
  ) {
    const updates: Array<Promise<unknown>> = [];

    if (post.institutionId) {
      updates.push(
        this.institutionModel
          .updateOne(
            { _id: post.institutionId },
            { $inc: { 'stats.postsCount': delta } },
          )
          .exec(),
      );
    }

    if (post.campaignId) {
      updates.push(
        this.campaignModel
          .updateOne(
            { _id: post.campaignId },
            { $inc: { 'stats.postsCount': delta } },
          )
          .exec(),
      );
    }

    await Promise.all(updates);
  }

  async create(createPostDto: CreatePostDto, currentUser?: AuthenticatedUser) {
    const user = this.requireCurrentUser(currentUser);
    const currentUserId = this.toObjectId(user.sub);
    const authorType = createPostDto.authorType ?? PostAuthorType.USER;
    const institutionId = createPostDto.institutionId
      ? this.toObjectId(createPostDto.institutionId)
      : undefined;
    const campaignId = createPostDto.campaignId
      ? this.toObjectId(createPostDto.campaignId)
      : undefined;
    const content = createPostDto.content?.trim();

    if (!content) {
      throw new BadRequestException('Post content is required');
    }

    await this.assertPostTargets({ campaignId, institutionId });

    let authorId = currentUserId;

    if (authorType === PostAuthorType.INSTITUTION) {
      if (!institutionId) {
        throw new BadRequestException('institutionId is required');
      }

      await this.assertCanPostAsInstitution(institutionId, currentUserId);
      authorId = institutionId;
    }

    const post = await this.postModel.create({
      authorType,
      authorId,
      campaignId,
      institutionId,
      content,
      media: createPostDto.media ?? [],
      visibility: createPostDto.visibility ?? PostVisibility.PUBLIC,
    });

    await this.incrementPostCounters(post, 1);

    return this.toPostResponse(post);
  }

  async findAll(query: PaginationQuery = {}) {
    const pagination = getPaginationOptions(query);
    const shouldReturnPaginated = shouldPaginate(query);
    const filter: Record<string, unknown> = {};

    if (pagination.search) {
      filter.content = { $regex: pagination.search, $options: 'i' };
    }

    const posts = await this.postModel
      .find(filter)
      .sort({ createdAt: pagination.sort === 'oldest' ? 1 : -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 0)
      .exec();
    const items = posts.map((post) => this.toPostResponse(post));

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.postModel.countDocuments(filter).exec();
    return paginatedResponse(items, total, pagination);
  }

  async feed(followerUserId?: string, query: PaginationQuery = {}) {
    const pagination = getPaginationOptions({
      limit: query.limit ?? '50',
      page: query.page,
      paginated: query.paginated,
      search: query.search,
      sort: query.sort,
    });
    const shouldReturnPaginated = shouldPaginate(query);
    const userId = this.toObjectId(followerUserId);
    const follows = await this.followModel
      .find({ followerUserId: userId })
      .lean()
      .exec();

    const followedInstitutionIds = follows
      .filter((follow) => follow.targetType === FollowTargetType.INSTITUTION)
      .map((follow) => follow.targetId);
    const followedCampaignIds = follows
      .filter((follow) => follow.targetType === FollowTargetType.CAMPAIGN)
      .map((follow) => follow.targetId);
    const followedUserIds = follows
      .filter((follow) => follow.targetType === FollowTargetType.USER)
      .map((follow) => follow.targetId);

    const followerOnlyConditions = [
      { institutionId: { $in: followedInstitutionIds } },
      { campaignId: { $in: followedCampaignIds } },
      {
        authorType: PostAuthorType.INSTITUTION,
        authorId: { $in: followedInstitutionIds },
      },
      {
        authorType: PostAuthorType.USER,
        authorId: { $in: followedUserIds },
      },
    ];

    const filter = {
        $or: [
          { visibility: PostVisibility.PUBLIC },
          {
            visibility: PostVisibility.FOLLOWERS_ONLY,
            $or: followerOnlyConditions,
          },
        ],
      };
    const posts = await this.postModel
      .find(filter)
      .sort({ createdAt: pagination.sort === 'oldest' ? 1 : -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 100)
      .exec();

    const items = posts.map((post) => this.toPostResponse(post));

    if (!shouldReturnPaginated) {
      return items;
    }

    const total = await this.postModel.countDocuments(filter).exec();
    return paginatedResponse(items, total, pagination);
  }

  async findOne(id: string, followerUserId?: string) {
    const post = await this.postModel.findById(id).exec();

    if (!post) return null;

    if (post.visibility === PostVisibility.PUBLIC) {
      return this.toPostResponse(post);
    }

    const userId = this.toObjectId(followerUserId);
    const followConditions = [
      post.institutionId
        ? {
            targetType: FollowTargetType.INSTITUTION,
            targetId: post.institutionId,
          }
        : undefined,
      post.campaignId
        ? { targetType: FollowTargetType.CAMPAIGN, targetId: post.campaignId }
        : undefined,
      post.authorType === PostAuthorType.USER
        ? { targetType: FollowTargetType.USER, targetId: post.authorId }
        : undefined,
      post.authorType === PostAuthorType.INSTITUTION
        ? { targetType: FollowTargetType.INSTITUTION, targetId: post.authorId }
        : undefined,
    ].filter(
      (
        condition,
      ): condition is {
        targetType: FollowTargetType;
        targetId: Types.ObjectId;
      } => Boolean(condition),
    );

    const canView = await this.followModel
      .exists({
        followerUserId: userId,
        $or: followConditions,
      })
      .exec();

    if (!canView) {
      throw new ForbiddenException('You cannot view this post');
    }

    return this.toPostResponse(post);
  }

  async update(id: string, updatePostDto: UpdatePostDto) {
    const update = {
      ...updatePostDto,
      content: updatePostDto.content?.trim() ?? updatePostDto.content,
    };
    const post = await this.postModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();

    return post ? this.toPostResponse(post) : null;
  }

  async remove(id: string) {
    const post = await this.postModel.findByIdAndDelete(id).exec();

    if (post) {
      await this.incrementPostCounters(post, -1);
    }

    return { id };
  }

  async share(id: string) {
    const post = await this.postModel
      .findByIdAndUpdate(
        this.toObjectId(id),
        { $inc: { 'stats.sharesCount': 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return {
      postId: id,
      sharesCount: post.stats?.sharesCount ?? 0,
    };
  }
}
