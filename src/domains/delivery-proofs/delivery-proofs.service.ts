import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ObjectStorageService } from '../../storage/object-storage.service';
import {
  Campaign,
  CampaignDocument,
} from '../campaigns/schemas/campaign.schema';
import { InstitutionStaffMembershipStatus } from '../institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import { CreateDeliveryProofDto } from './dto/create-delivery-proof.dto';
import { UpdateDeliveryProofDto } from './dto/update-delivery-proof.dto';
import { UploadDeliveryProofAssetDto } from './dto/upload-delivery-proof-asset.dto';
import {
  DeliveryProof,
  DeliveryProofDocument,
} from './schemas/delivery-proof.schema';

@Injectable()
export class DeliveryProofsService {
  constructor(
    @InjectModel(DeliveryProof.name)
    private readonly deliveryProofModel: Model<DeliveryProofDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly staffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private requireCurrentUser(currentUser?: AuthenticatedUser) {
    if (!currentUser) {
      throw new ForbiddenException('Authenticated user is required');
    }

    return currentUser;
  }

  private toResponse(deliveryProof: DeliveryProofDocument | DeliveryProof) {
    return {
      id: deliveryProof._id?.toString(),
      campaignId: deliveryProof.campaignId?.toString(),
      donationId: deliveryProof.donationId?.toString(),
      photoUrl: deliveryProof.photoUrl,
      fileName: deliveryProof.fileName,
      contentType: deliveryProof.contentType,
      description: deliveryProof.description,
      confirmedByUserId: deliveryProof.confirmedByUserId?.toString(),
      confirmedAt:
        deliveryProof.confirmedAt?.toISOString?.() ?? deliveryProof.confirmedAt,
      metadata: deliveryProof.metadata,
      createdAt:
        deliveryProof.createdAt?.toISOString?.() ?? deliveryProof.createdAt,
    };
  }

  private async assertCanCreateProof(
    campaignId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    const campaign = await this.campaignModel
      .findById(campaignId)
      .select('institutionId')
      .lean()
      .exec();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const membership = await this.staffMembershipModel
      .exists({
        institutionId: campaign.institutionId,
        userId,
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .exec();

    if (!membership) {
      throw new ForbiddenException(
        'Only active institution staff can create delivery proofs',
      );
    }
  }

  async create(
    createDeliveryProofDto: CreateDeliveryProofDto,
    currentUser?: AuthenticatedUser,
  ) {
    const user = this.requireCurrentUser(currentUser);
    const userId = this.toObjectId(user.sub);
    const campaignId = createDeliveryProofDto.campaignId
      ? this.toObjectId(createDeliveryProofDto.campaignId)
      : undefined;

    if (!campaignId) {
      throw new BadRequestException('campaignId is required');
    }

    if (!createDeliveryProofDto.photoUrl?.trim()) {
      throw new BadRequestException('proof file is required');
    }

    await this.assertCanCreateProof(campaignId, userId);

    const deliveryProof = await this.deliveryProofModel.create({
      ...createDeliveryProofDto,
      campaignId,
      confirmedAt: createDeliveryProofDto.confirmedAt ?? new Date(),
      confirmedByUserId: userId,
    });

    return this.toResponse(deliveryProof);
  }

  async uploadAsset(uploadDeliveryProofAssetDto: UploadDeliveryProofAssetDto) {
    const contentType = uploadDeliveryProofAssetDto.contentType
      ?.trim()
      .toLowerCase();
    const allowedTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ]);

    if (!allowedTypes.has(contentType)) {
      throw new BadRequestException(
        'O comprovante precisa ser PDF, JPG ou PNG.',
      );
    }

    const body = Buffer.from(uploadDeliveryProofAssetDto.base64, 'base64');
    const maxSizeBytes = 10 * 1024 * 1024;

    if (!body.byteLength || body.byteLength > maxSizeBytes) {
      throw new BadRequestException('O comprovante precisa ter até 10MB.');
    }

    const extension =
      contentType === 'application/pdf'
        ? 'pdf'
        : contentType.includes('png')
          ? 'png'
          : 'jpg';
    const fileName = `${randomUUID()}.${extension}`;
    const key = `delivery-proofs/${fileName}`;

    const storedObject = await this.objectStorageService.putObject({
      body,
      contentDisposition: `inline; filename="${fileName}"`,
      contentType,
      key,
    });

    return {
      contentType: storedObject.contentType,
      fileName,
      key: storedObject.key,
      provider: storedObject.provider,
      size: storedObject.size,
      url: `/delivery-proofs/uploads/${fileName}`,
    };
  }

  getUploadedAssetUrl(fileName: string) {
    if (!/^[a-f0-9-]+\.(jpg|png|pdf)$/i.test(fileName)) {
      throw new NotFoundException('Arquivo não encontrado.');
    }

    const contentType = fileName.endsWith('.pdf')
      ? 'application/pdf'
      : fileName.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

    return this.objectStorageService.getSignedDownloadUrl({
      contentType,
      filename: fileName,
      key: `delivery-proofs/${fileName}`,
    });
  }

  async findAll() {
    const deliveryProofs = await this.deliveryProofModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return deliveryProofs.map((deliveryProof) =>
      this.toResponse(deliveryProof),
    );
  }

  async findOne(id: string) {
    const deliveryProof = await this.deliveryProofModel.findById(id).exec();

    return deliveryProof ? this.toResponse(deliveryProof) : null;
  }

  async update(id: string, updateDeliveryProofDto: UpdateDeliveryProofDto) {
    const deliveryProof = await this.deliveryProofModel
      .findByIdAndUpdate(id, updateDeliveryProofDto, {
        returnDocument: 'after',
      })
      .exec();

    return deliveryProof ? this.toResponse(deliveryProof) : null;
  }

  remove(id: string) {
    return this.deliveryProofModel.findByIdAndDelete(id).exec();
  }
}
