import { Types } from 'mongoose';

import {
  CampaignDonationType,
  CampaignStatus,
  CampaignVisibility,
} from '../models';
import type {
  CampaignAcceptedItem,
  CampaignAddress,
  CampaignGoal,
  CampaignProgress,
  CampaignStats,
} from '../models';

export class CreateCampaignDto {
  institutionId!: Types.ObjectId;

  createdByUserId!: Types.ObjectId;

  title!: string;

  description?: string;

  bannerUrl?: string;

  status?: CampaignStatus;

  donationTypes!: CampaignDonationType[];

  acceptedItems?: CampaignAcceptedItem[];

  goal?: CampaignGoal;

  progress?: CampaignProgress;

  visibility?: CampaignVisibility;

  startAt?: Date;

  endAt?: Date;

  address?: CampaignAddress;

  tags?: string[];

  stats?: CampaignStats;
}
