import {
  DonationDeliveryMode,
  DonationStatus,
  DonationType,
  DonationVisibility,
} from '../models';
import type { DonationItemDonation, DonationMoneyDonation } from '../models';

export class CreateDonationDto {
  amountCents?: number;

  campaignId?: string;

  type?: DonationType;

  status?: DonationStatus;

  visibility?: DonationVisibility;

  moneyDonation?: DonationMoneyDonation;

  itemDonation?: DonationItemDonation;

  deliveryMode?: DonationDeliveryMode;

  scheduledAt?: Date;

  note?: string;

  receiptEligible?: boolean;

  proofPhotoUrl?: string;

  deliveredAt?: Date;
}
