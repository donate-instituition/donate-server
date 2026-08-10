import { Types } from 'mongoose';

import type { DeliveryProofMetadata } from '../models';

export class CreateDeliveryProofDto {
  donationId?: Types.ObjectId;

  campaignId?: Types.ObjectId;

  photoUrl?: string;

  fileName?: string;

  contentType?: string;

  description?: string;

  confirmedByUserId?: Types.ObjectId;

  confirmedAt?: Date;

  metadata?: DeliveryProofMetadata;
}
