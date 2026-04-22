import { Types } from 'mongoose';

import { InstitutionStatus } from '../models';
import type {
  InstitutionAddress,
  InstitutionStats,
  InstitutionVerification,
} from '../models';

export class CreateInstitutionDto {
  legalName!: string;

  displayName!: string;

  cnpj!: string;

  email!: string;

  phone?: string;

  description!: string;

  categoryIds?: Types.ObjectId[];

  logoUrl?: string;

  coverPhotoUrl?: string;

  website?: string;

  status?: InstitutionStatus;

  verification?: InstitutionVerification;

  address?: InstitutionAddress;

  acceptedDonationTypes?: string[];

  pixKey?: string;

  taxReceiptEnabled?: boolean;

  stats?: InstitutionStats;
}
