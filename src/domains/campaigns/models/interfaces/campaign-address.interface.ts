import type { InstitutionLocation } from '../../../institutions/models';

export interface CampaignAddress {
  sameAsInstitution?: boolean;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  location?: InstitutionLocation;
}
