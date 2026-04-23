import { Types } from 'mongoose';

export class CreatePostCommentDto {
  postId!: Types.ObjectId;

  userId!: Types.ObjectId;

  parentCommentId?: Types.ObjectId;

  content!: string;
}
