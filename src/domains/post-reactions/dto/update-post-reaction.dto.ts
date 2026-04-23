import { Types } from 'mongoose';

import { PostReactionType } from '../models';

export class UpdatePostReactionDto {
  postId?: Types.ObjectId;

  userId?: Types.ObjectId;

  type?: PostReactionType;
}
