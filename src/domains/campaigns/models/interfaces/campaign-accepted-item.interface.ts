import { CampaignItemCategory } from '../enums';

export interface CampaignAcceptedItem {
  category?: CampaignItemCategory;
  name?: string;
  description?: string;
}
