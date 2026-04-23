import { Types } from 'mongoose';

export class UpdatePostCommentDto {
  postId?: Types.ObjectId;

  userId?: Types.ObjectId;

  parentCommentId?: Types.ObjectId;

  content?: string;
}
