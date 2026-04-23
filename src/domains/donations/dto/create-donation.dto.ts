import { Types } from 'mongoose';

import {
  DonationDeliveryMode,
  DonationStatus,
  DonationType,
  DonationVisibility,
} from '../models';
import type {
  DonationItemDonation,
  DonationMoneyDonation,
} from '../models';

export class CreateDonationDto {
  donorUserId!: Types.ObjectId;

  institutionId!: Types.ObjectId;

  campaignId?: Types.ObjectId;

  type!: DonationType;

  status?: DonationStatus;

  visibility?: DonationVisibility;

  moneyDonation?: DonationMoneyDonation;

  itemDonation?: DonationItemDonation;

  deliveryMode!: DonationDeliveryMode;

  scheduledAt?: Date;

  note?: string;

  receiptEligible?: boolean;

  proofPhotoUrl?: string;

  deliveredAt?: Date;
}
