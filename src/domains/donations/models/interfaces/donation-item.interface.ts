import {
  DonationItemCategory,
  DonationItemCondition,
  DonationItemUnit,
} from '../enums';

export interface DonationItem {
  category?: DonationItemCategory;
  name?: string;
  quantity?: number;
  unit?: DonationItemUnit;
  condition?: DonationItemCondition;
}
