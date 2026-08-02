import { InstitutionStaffMembershipRole } from '../models';

export class CreateInstitutionStaffUserDto {
  institutionId!: string;

  name!: string;

  email!: string;

  password!: string;

  role?: InstitutionStaffMembershipRole;

  permissions?: string[];
}
