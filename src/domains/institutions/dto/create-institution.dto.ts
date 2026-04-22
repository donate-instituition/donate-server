import { Types } from 'mongoose';

import { InstitutionVerificationStatus } from '../models';

export class CreateInstitutionDto {
  userId!: Types.ObjectId;

  razaoSocial!: string;

  nomeFantasia!: string;

  cnpj!: string;

  description!: string;

  category?: string;

  contactEmail!: string;

  contactPhone?: string;

  websiteUrl?: string;

  pixKey?: string;

  verificationStatus?: InstitutionVerificationStatus;

  addressId?: Types.ObjectId;
}
