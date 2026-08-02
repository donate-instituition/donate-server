import { PostAuthorType, PostVisibility } from '../models';
import type { PostMedia, PostStats } from '../models';

export class CreatePostDto {
  authorType!: PostAuthorType;

  authorId?: string;

  campaignId?: string;

  institutionId?: string;

  content!: string;

  media?: PostMedia[];

  visibility?: PostVisibility;

  stats?: PostStats;
}
