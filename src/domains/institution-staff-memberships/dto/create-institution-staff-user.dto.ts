import { InstitutionStaffMembershipRole } from '../models';

export class CreateInstitutionStaffUserDto {
  institutionId!: string;

  name!: string;

  email!: string;

  cpf?: string;

  birthDate?: string;

  phone?: string;

  password?: string;

  passwordMode?: 'manual' | 'generated';

  forcePasswordChange?: boolean;

  role?: InstitutionStaffMembershipRole;

  permissions?: string[];
}
