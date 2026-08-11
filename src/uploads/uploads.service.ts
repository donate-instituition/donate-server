import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';

import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  Campaign,
  CampaignDocument,
} from '../domains/campaigns/schemas/campaign.schema';
import {
  Donation,
  DonationDocument,
} from '../domains/donations/schemas/donation.schema';
import { InstitutionStaffMembershipStatus } from '../domains/institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../domains/institution-staff-memberships/schemas/institution-staff-membership.schema';
import { UserRole } from '../domains/users/models';
import { ObjectStorageService } from '../storage/object-storage.service';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UploadCategory } from './models';
import {
  buildFinalKey,
  buildTempKey,
  extensionForContentType,
  isPublicCategory,
  UPLOAD_VALIDATION_RULES,
  type UploadKeyParams,
} from './upload-key.util';

@Injectable()
export class UploadsService {
  constructor(
    @InjectModel(InstitutionStaffMembership.name)
    private readonly institutionStaffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async createUpload(createUploadDto: CreateUploadDto) {
    const rule = UPLOAD_VALIDATION_RULES[createUploadDto.category];

    if (!rule) {
      throw new BadRequestException('Invalid upload category');
    }

    const contentType = createUploadDto.contentType?.trim().toLowerCase();

    if (!rule.allowedContentTypes.includes(contentType)) {
      throw new BadRequestException(
        'Unsupported content type for this upload category',
      );
    }

    const body = Buffer.from(createUploadDto.base64, 'base64');

    if (!body.byteLength || body.byteLength > rule.maxSizeBytes) {
      throw new BadRequestException(
        `File must be up to ${rule.maxSizeBytes / (1024 * 1024)}MB`,
      );
    }

    const uploadId = randomUUID();
    const extension = extensionForContentType(contentType);
    const fileName = `${randomUUID()}.${extension}`;
    const key = buildTempKey(uploadId, fileName);

    const storedObject = await this.objectStorageService.putObject({
      body,
      contentDisposition: `inline; filename="${fileName}"`,
      contentType,
      key,
    });

    return {
      category: createUploadDto.category,
      contentType: storedObject.contentType,
      fileName,
      size: storedObject.size,
      uploadId,
    };
  }

  async confirmUpload(
    uploadId: string,
    confirmUploadDto: ConfirmUploadDto,
    user: AuthenticatedUser,
  ) {
    if (!Object.values(UploadCategory).includes(confirmUploadDto.category)) {
      throw new BadRequestException('Invalid upload category');
    }

    if (!confirmUploadDto.fileName) {
      throw new BadRequestException('fileName is required');
    }

    const params = await this.assertCanConfirm(confirmUploadDto, user);

    const fromKey = buildTempKey(uploadId, confirmUploadDto.fileName);
    const toKey = buildFinalKey(
      confirmUploadDto.category,
      params,
      confirmUploadDto.fileName,
    );

    await this.objectStorageService.moveObject({ fromKey, toKey });

    if (isPublicCategory(confirmUploadDto.category)) {
      return {
        key: toKey,
        url: `/uploads/public?key=${encodeURIComponent(toKey)}`,
      };
    }

    return { key: toKey };
  }

  async getPublicDownloadUrl(key: string): Promise<string> {
    if (!key.startsWith('public/')) {
      throw new NotFoundException('File not found');
    }

    return this.objectStorageService.getSignedDownloadUrl({ key });
  }

  async getPrivateDownloadUrl(
    key: string,
    user: AuthenticatedUser,
  ): Promise<string> {
    if (!key.startsWith('private/')) {
      throw new NotFoundException('File not found');
    }

    await this.assertCanReadPrivateKey(key, user);

    return this.objectStorageService.getSignedDownloadUrl({ key });
  }

  private async assertCanConfirm(
    confirmUploadDto: ConfirmUploadDto,
    user: AuthenticatedUser,
  ): Promise<UploadKeyParams> {
    const userId = user.sub;

    switch (confirmUploadDto.category) {
      case UploadCategory.USER_AVATAR:
      case UploadCategory.USER_DOCUMENT:
        return { userId };

      case UploadCategory.INSTITUTION_LOGO:
      case UploadCategory.INSTITUTION_COVER:
      case UploadCategory.INSTITUTION_DOCUMENT:
      case UploadCategory.INSTITUTION_REPORT: {
        if (!confirmUploadDto.institutionId) {
          throw new BadRequestException('institutionId is required');
        }

        await this.assertActiveInstitutionStaff(
          confirmUploadDto.institutionId,
          userId,
        );

        return { institutionId: confirmUploadDto.institutionId, userId };
      }

      case UploadCategory.CAMPAIGN_BANNER: {
        const institutionId = await this.assertCanManageCampaignAsset(
          confirmUploadDto.campaignId,
          userId,
        );

        return {
          campaignId: confirmUploadDto.campaignId,
          institutionId,
          userId,
        };
      }

      case UploadCategory.DELIVERY_PROOF: {
        await this.assertCanManageCampaignAsset(
          confirmUploadDto.campaignId,
          userId,
        );

        return { campaignId: confirmUploadDto.campaignId, userId };
      }

      case UploadCategory.POST_MEDIA: {
        if (confirmUploadDto.institutionId) {
          await this.assertActiveInstitutionStaff(
            confirmUploadDto.institutionId,
            userId,
          );

          return {
            institutionId: confirmUploadDto.institutionId,
            postId: confirmUploadDto.postId,
            userId,
          };
        }

        return { postId: confirmUploadDto.postId, userId };
      }

      case UploadCategory.DONATION_ATTACHMENT: {
        if (
          !confirmUploadDto.donationId ||
          !Types.ObjectId.isValid(confirmUploadDto.donationId)
        ) {
          throw new BadRequestException('donationId is required');
        }

        const donation = await this.donationModel
          .findById(confirmUploadDto.donationId)
          .select('donorUserId institutionId')
          .lean()
          .exec();

        if (!donation) {
          throw new NotFoundException('Donation not found');
        }

        if (donation.donorUserId?.toString() !== userId) {
          await this.assertActiveInstitutionStaff(
            donation.institutionId.toString(),
            userId,
          );
        }

        return { donationId: confirmUploadDto.donationId, userId };
      }

      default:
        throw new BadRequestException(
          `Unsupported upload category: ${confirmUploadDto.category as string}`,
        );
    }
  }

  private async assertCanReadPrivateKey(key: string, user: AuthenticatedUser) {
    if (user.roles?.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }

    const userMatch = key.match(/^private\/users\/([^/]+)\//);

    if (userMatch) {
      if (userMatch[1] === user.sub) {
        return;
      }

      throw new ForbiddenException('Not allowed to access this file');
    }

    const institutionMatch = key.match(/^private\/institutions\/([^/]+)\//);

    if (institutionMatch) {
      await this.assertActiveInstitutionStaff(institutionMatch[1], user.sub);
      return;
    }

    const campaignMatch = key.match(/^private\/campaigns\/([^/]+)\/proofs\//);

    if (campaignMatch) {
      await this.assertCanManageCampaignAsset(campaignMatch[1], user.sub);
      return;
    }

    const donationMatch = key.match(/^private\/donations\/([^/]+)\//);

    if (donationMatch) {
      if (!Types.ObjectId.isValid(donationMatch[1])) {
        throw new NotFoundException('File not found');
      }

      const donation = await this.donationModel
        .findById(donationMatch[1])
        .select('donorUserId institutionId')
        .lean()
        .exec();

      if (!donation) {
        throw new NotFoundException('File not found');
      }

      if (donation.donorUserId?.toString() === user.sub) {
        return;
      }

      await this.assertActiveInstitutionStaff(
        donation.institutionId.toString(),
        user.sub,
      );
      return;
    }

    throw new ForbiddenException('Not allowed to access this file');
  }

  private async assertCanManageCampaignAsset(
    campaignId: string | undefined,
    userId: string,
  ): Promise<string> {
    if (!campaignId || !Types.ObjectId.isValid(campaignId)) {
      throw new BadRequestException('campaignId is required');
    }

    const campaign = await this.campaignModel
      .findById(campaignId)
      .select('institutionId')
      .lean()
      .exec();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.assertActiveInstitutionStaff(
      campaign.institutionId.toString(),
      userId,
    );

    return campaign.institutionId.toString();
  }

  private async assertActiveInstitutionStaff(
    institutionId: string,
    userId: string,
  ) {
    if (
      !Types.ObjectId.isValid(institutionId) ||
      !Types.ObjectId.isValid(userId)
    ) {
      throw new BadRequestException('Invalid institution or user id');
    }

    const membership = await this.institutionStaffMembershipModel
      .exists({
        institutionId: new Types.ObjectId(institutionId),
        status: InstitutionStaffMembershipStatus.ACTIVE,
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!membership) {
      throw new ForbiddenException(
        'Only active institution staff can perform this action',
      );
    }
  }
}
