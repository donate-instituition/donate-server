import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CountersService } from '../../cache';
import { Post as PostEntity, PostDocument } from '../posts/schemas/post.schema';
import { CreatePostReactionDto } from './dto/create-post-reaction.dto';
import { UpdatePostReactionDto } from './dto/update-post-reaction.dto';
import { PostReactionType } from './models';
import {
  PostReaction,
  PostReactionDocument,
} from './schemas/post-reaction.schema';

@Injectable()
export class PostReactionsService {
  constructor(
    @InjectModel(PostReaction.name)
    private readonly postReactionModel: Model<PostReactionDocument>,
    @InjectModel(PostEntity.name)
    private readonly postModel: Model<PostDocument>,
    private readonly countersService: CountersService,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toReactionResponse(reaction: PostReactionDocument | PostReaction) {
    return {
      id: reaction._id?.toString(),
      postId: reaction.postId?.toString(),
      userId: reaction.userId?.toString(),
      type: reaction.type,
      createdAt: reaction.createdAt?.toISOString?.() ?? reaction.createdAt,
    };
  }

  async create(createPostReactionDto: CreatePostReactionDto, userId?: string) {
    const postId = this.toObjectId(createPostReactionDto.postId);
    const ownerId = this.toObjectId(userId);
    const type = createPostReactionDto.type ?? PostReactionType.LIKE;

    const post = await this.postModel.exists({ _id: postId }).exec();
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.postReactionModel
      .findOne({ postId, userId: ownerId })
      .exec();

    if (existing) {
      if (existing.type !== type) {
        existing.type = type;
        await existing.save();
      }

      return this.toReactionResponse(existing);
    }

    const reaction = await this.postReactionModel.create({
      postId,
      userId: ownerId,
      type,
    });

    if (type === PostReactionType.LIKE) {
      await this.countersService.bufferIncrement(
        'post',
        postId.toString(),
        'likesCount',
        1,
        async () => {
          await this.postModel
            .updateOne({ _id: postId }, { $inc: { 'stats.likesCount': 1 } })
            .exec();
        },
      );
    }

    return this.toReactionResponse(reaction);
  }

  async getMyLikedPostIds(userId?: string) {
    const ownerId = this.toObjectId(userId);
    const reactions = await this.postReactionModel
      .find({ userId: ownerId, type: PostReactionType.LIKE })
      .select('postId')
      .lean()
      .exec();

    return reactions.map((reaction) => reaction.postId.toString());
  }

  async findAll() {
    const reactions = await this.postReactionModel
      .find()
      .sort({ createdAt: -1 })
      .exec();

    return reactions.map((reaction) => this.toReactionResponse(reaction));
  }

  async findOne(id: string) {
    const reaction = await this.postReactionModel.findById(id).exec();
    return reaction ? this.toReactionResponse(reaction) : null;
  }

  async update(id: string, updatePostReactionDto: UpdatePostReactionDto) {
    const reaction = await this.postReactionModel
      .findByIdAndUpdate(id, updatePostReactionDto, { returnDocument: 'after' })
      .exec();

    return reaction ? this.toReactionResponse(reaction) : null;
  }

  async remove(id: string) {
    const reaction = await this.postReactionModel.findByIdAndDelete(id).exec();

    if (reaction?.type === PostReactionType.LIKE) {
      await this.countersService.bufferIncrement(
        'post',
        reaction.postId.toString(),
        'likesCount',
        -1,
        async () => {
          await this.postModel
            .updateOne(
              { _id: reaction.postId },
              { $inc: { 'stats.likesCount': -1 } },
            )
            .exec();
        },
      );
    }

    return { id };
  }

  async removeMineByPost(postId: string, userId?: string) {
    const parsedPostId = this.toObjectId(postId);
    const ownerId = this.toObjectId(userId);
    const reaction = await this.postReactionModel
      .findOneAndDelete({ postId: parsedPostId, userId: ownerId })
      .exec();

    if (reaction?.type === PostReactionType.LIKE) {
      await this.countersService.bufferIncrement(
        'post',
        parsedPostId.toString(),
        'likesCount',
        -1,
        async () => {
          await this.postModel
            .updateOne(
              { _id: parsedPostId },
              { $inc: { 'stats.likesCount': -1 } },
            )
            .exec();
        },
      );
    }

    return { postId };
  }
}
