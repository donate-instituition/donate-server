import type { InstitutionLocation } from './institution-location.interface';

export interface InstitutionAddress {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  location?: InstitutionLocation;
}
