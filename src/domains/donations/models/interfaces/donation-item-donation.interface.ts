import type { DonationItem } from './donation-item.interface';

export interface DonationItemDonation {
  items?: DonationItem[];
  estimatedValue?: number;
}
