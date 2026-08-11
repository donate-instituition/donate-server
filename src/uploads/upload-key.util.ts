import { BadRequestException } from '@nestjs/common';

import { UploadCategory } from './models';

export type UploadKeyParams = {
  campaignId?: string;
  donationId?: string;
  institutionId?: string;
  postId?: string;
  userId?: string;
};

type UploadValidationRule = {
  allowedContentTypes: string[];
  maxSizeBytes: number;
};

const IMAGE_RULE: UploadValidationRule = {
  allowedContentTypes: ['image/jpeg', 'image/jpg', 'image/png'],
  maxSizeBytes: 5 * 1024 * 1024,
};

const DOCUMENT_RULE: UploadValidationRule = {
  allowedContentTypes: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ],
  maxSizeBytes: 10 * 1024 * 1024,
};

export const UPLOAD_VALIDATION_RULES: Record<
  UploadCategory,
  UploadValidationRule
> = {
  [UploadCategory.USER_AVATAR]: IMAGE_RULE,
  [UploadCategory.INSTITUTION_LOGO]: IMAGE_RULE,
  [UploadCategory.INSTITUTION_COVER]: IMAGE_RULE,
  [UploadCategory.CAMPAIGN_BANNER]: IMAGE_RULE,
  [UploadCategory.POST_MEDIA]: IMAGE_RULE,
  [UploadCategory.USER_DOCUMENT]: DOCUMENT_RULE,
  [UploadCategory.INSTITUTION_DOCUMENT]: DOCUMENT_RULE,
  [UploadCategory.INSTITUTION_REPORT]: DOCUMENT_RULE,
  [UploadCategory.DELIVERY_PROOF]: DOCUMENT_RULE,
  [UploadCategory.DONATION_ATTACHMENT]: DOCUMENT_RULE,
};

const PUBLIC_CATEGORIES = new Set<UploadCategory>([
  UploadCategory.USER_AVATAR,
  UploadCategory.INSTITUTION_LOGO,
  UploadCategory.INSTITUTION_COVER,
  UploadCategory.CAMPAIGN_BANNER,
  UploadCategory.POST_MEDIA,
]);

export function isPublicCategory(category: UploadCategory): boolean {
  return PUBLIC_CATEGORIES.has(category);
}

export function extensionForContentType(contentType: string): string {
  if (contentType === 'application/pdf') {
    return 'pdf';
  }

  return contentType.includes('png') ? 'png' : 'jpg';
}

export function buildTempKey(uploadId: string, fileName: string): string {
  return `temp/${uploadId}/${fileName}`;
}

function requireParam(
  params: UploadKeyParams,
  key: keyof UploadKeyParams,
  category: UploadCategory,
): string {
  const value = params[key];

  if (!value) {
    throw new BadRequestException(
      `${key} is required to confirm a ${category} upload`,
    );
  }

  return value;
}

export function buildFinalKey(
  category: UploadCategory,
  params: UploadKeyParams,
  fileName: string,
): string {
  switch (category) {
    case UploadCategory.USER_AVATAR:
      return `public/users/${requireParam(params, 'userId', category)}/avatar/${fileName}`;
    case UploadCategory.USER_DOCUMENT:
      return `private/users/${requireParam(params, 'userId', category)}/documents/${fileName}`;
    case UploadCategory.INSTITUTION_LOGO:
      return `public/institutions/${requireParam(params, 'institutionId', category)}/logo/${fileName}`;
    case UploadCategory.INSTITUTION_COVER:
      return `public/institutions/${requireParam(params, 'institutionId', category)}/cover/${fileName}`;
    case UploadCategory.INSTITUTION_DOCUMENT:
      return `private/institutions/${requireParam(params, 'institutionId', category)}/documents/${fileName}`;
    case UploadCategory.INSTITUTION_REPORT:
      return `private/institutions/${requireParam(params, 'institutionId', category)}/reports/${fileName}`;
    case UploadCategory.CAMPAIGN_BANNER: {
      const institutionId = requireParam(params, 'institutionId', category);
      const campaignId = requireParam(params, 'campaignId', category);
      return `public/institutions/${institutionId}/campaigns/${campaignId}/${fileName}`;
    }
    case UploadCategory.POST_MEDIA: {
      const postId = requireParam(params, 'postId', category);
      if (params.institutionId) {
        return `public/institutions/${params.institutionId}/posts/${postId}/${fileName}`;
      }
      return `public/users/${requireParam(params, 'userId', category)}/posts/${postId}/${fileName}`;
    }
    case UploadCategory.DELIVERY_PROOF:
      return `private/campaigns/${requireParam(params, 'campaignId', category)}/proofs/${fileName}`;
    case UploadCategory.DONATION_ATTACHMENT:
      return `private/donations/${requireParam(params, 'donationId', category)}/attachments/${fileName}`;
    default:
      throw new BadRequestException(
        `Unsupported upload category: ${category as string}`,
      );
  }
}
