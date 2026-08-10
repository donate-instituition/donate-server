import { Types } from 'mongoose';

import { InstitutionDonationType, InstitutionStatus } from '../models';
import type {
  InstitutionAddress,
  InstitutionStats,
  InstitutionStripeConnect,
  InstitutionVerification,
} from '../models';

export class UpdateInstitutionDto {
  legalName?: string;

  displayName?: string;

  cnpj?: string;

  email?: string;

  phone?: string;

  description?: string;

  categoryIds?: Types.ObjectId[];

  logoUrl?: string;

  coverPhotoUrl?: string;

  website?: string;

  status?: InstitutionStatus;

  verification?: InstitutionVerification;

  address?: InstitutionAddress;

  acceptedDonationTypes?: InstitutionDonationType[];

  pixKey?: string;

  stripeConnectAccountId?: string;

  stripeConnect?: InstitutionStripeConnect;

  acceptsRecurringDonations?: boolean;

  taxReceiptEnabled?: boolean;

  stats?: InstitutionStats;
}
