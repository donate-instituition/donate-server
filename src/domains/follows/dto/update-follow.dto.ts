import { Types } from 'mongoose';

import { FollowTargetType } from '../models';

export class UpdateFollowDto {
  followerUserId?: Types.ObjectId;

  targetType?: FollowTargetType;

  targetId?: Types.ObjectId;
}
