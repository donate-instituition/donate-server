import { Types } from 'mongoose';

import { PostAuthorType, PostVisibility } from '../models';
import type { PostMedia, PostStats } from '../models';

export class CreatePostDto {
  authorType!: PostAuthorType;

  authorId!: Types.ObjectId;

  campaignId?: Types.ObjectId;

  institutionId?: Types.ObjectId;

  content!: string;

  media?: PostMedia[];

  visibility?: PostVisibility;

  stats?: PostStats;
}
