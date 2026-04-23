import { Types } from 'mongoose';

import { FollowTargetType } from '../models';

export class CreateFollowDto {
  followerUserId!: Types.ObjectId;

  targetType!: FollowTargetType;

  targetId!: Types.ObjectId;
}
