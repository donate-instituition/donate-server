import { Types } from 'mongoose';

import { DonationStatus } from '../../donations/models';
import { DonationStatusHistorySource } from '../models';

export class CreateDonationStatusHistoryDto {
  donationId!: Types.ObjectId;

  fromStatus?: DonationStatus;

  toStatus!: DonationStatus;

  changedByUserId?: Types.ObjectId;

  source!: DonationStatusHistorySource;

  note?: string;
}
