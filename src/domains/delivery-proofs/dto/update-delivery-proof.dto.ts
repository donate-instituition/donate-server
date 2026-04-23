import { Types } from 'mongoose';

import type { DeliveryProofMetadata } from '../models';

export class UpdateDeliveryProofDto {
  donationId?: Types.ObjectId;

  photoUrl?: string;

  description?: string;

  confirmedByUserId?: Types.ObjectId;

  confirmedAt?: Date;

  metadata?: DeliveryProofMetadata;
}
