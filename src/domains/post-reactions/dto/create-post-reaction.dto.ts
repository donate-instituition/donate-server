import { Types } from 'mongoose';

import { PostReactionType } from '../models';

export class CreatePostReactionDto {
  postId!: Types.ObjectId;

  userId!: Types.ObjectId;

  type!: PostReactionType;
}
