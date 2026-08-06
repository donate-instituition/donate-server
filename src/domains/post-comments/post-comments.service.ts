import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Post as PostEntity, PostDocument } from '../posts/schemas/post.schema';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { UpdatePostCommentDto } from './dto/update-post-comment.dto';
import {
  PostComment,
  PostCommentDocument,
} from './schemas/post-comment.schema';

@Injectable()
export class PostCommentsService {
  constructor(
    @InjectModel(PostComment.name)
    private readonly postCommentModel: Model<PostCommentDocument>,
    @InjectModel(PostEntity.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private toCommentResponse(comment: PostCommentDocument | PostComment) {
    return {
      id: comment._id?.toString(),
      postId: comment.postId?.toString(),
      userId: comment.userId?.toString(),
      parentCommentId: comment.parentCommentId?.toString(),
      content: comment.content,
      createdAt: comment.createdAt?.toISOString?.() ?? comment.createdAt,
      updatedAt: comment.updatedAt?.toISOString?.() ?? comment.updatedAt,
    };
  }

  async create(createPostCommentDto: CreatePostCommentDto, userId?: string) {
    const postId = this.toObjectId(createPostCommentDto.postId);
    const authorUserId = this.toObjectId(userId);
    const parentCommentId = createPostCommentDto.parentCommentId
      ? this.toObjectId(createPostCommentDto.parentCommentId)
      : undefined;
    const content = createPostCommentDto.content?.trim();

    if (!content) {
      throw new BadRequestException('Comment content is required');
    }

    const post = await this.postModel.exists({ _id: postId }).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (parentCommentId) {
      const parent = await this.postCommentModel
        .exists({ _id: parentCommentId, postId })
        .exec();
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    const comment = await this.postCommentModel.create({
      postId,
      userId: authorUserId,
      parentCommentId,
      content,
    });

    await this.postModel
      .updateOne({ _id: postId }, { $inc: { 'stats.commentsCount': 1 } })
      .exec();

    return this.toCommentResponse(comment);
  }

  async findAll() {
    const comments = await this.postCommentModel
      .find()
      .sort({ createdAt: -1 })
      .exec();

    return comments.map((comment) => this.toCommentResponse(comment));
  }

  async findByPost(postId: string) {
    const comments = await this.postCommentModel
      .find({ postId: this.toObjectId(postId) })
      .sort({ createdAt: 1 })
      .exec();

    return comments.map((comment) => this.toCommentResponse(comment));
  }

  async findOne(id: string) {
    const comment = await this.postCommentModel.findById(id).exec();
    return comment ? this.toCommentResponse(comment) : null;
  }

  async update(id: string, updatePostCommentDto: UpdatePostCommentDto) {
    const content = updatePostCommentDto.content?.trim();

    if (updatePostCommentDto.content !== undefined && !content) {
      throw new BadRequestException('Comment content is required');
    }

    const comment = await this.postCommentModel
      .findByIdAndUpdate(
        id,
        { ...updatePostCommentDto, content },
        { returnDocument: 'after' },
      )
      .exec();

    return comment ? this.toCommentResponse(comment) : null;
  }

  async remove(id: string) {
    const comment = await this.postCommentModel.findByIdAndDelete(id).exec();

    if (comment) {
      await this.postModel
        .updateOne(
          { _id: comment.postId },
          { $inc: { 'stats.commentsCount': -1 } },
        )
        .exec();
    }

    return { id };
  }

  async assertOwner(id: string, userId?: string) {
    const comment = await this.postCommentModel.findById(id).lean().exec();

    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.userId.toString() !== this.toObjectId(userId).toString()) {
      throw new ForbiddenException('You cannot edit this comment');
    }
  }
}
