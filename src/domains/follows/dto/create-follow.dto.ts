import { FollowTargetType } from '../models';

export class CreateFollowDto {
  targetType!: FollowTargetType;

  targetId!: string;
}
