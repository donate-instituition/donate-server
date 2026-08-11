import { UploadCategory } from '../models';

export class ConfirmUploadDto {
  category!: UploadCategory;

  fileName!: string;

  campaignId?: string;

  donationId?: string;

  institutionId?: string;

  postId?: string;
}
