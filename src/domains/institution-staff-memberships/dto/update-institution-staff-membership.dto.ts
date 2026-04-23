import { Types } from 'mongoose';

import {
  InstitutionStaffMembershipRole,
  InstitutionStaffMembershipStatus,
} from '../models';

export class UpdateInstitutionStaffMembershipDto {
  institutionId?: Types.ObjectId;

  userId?: Types.ObjectId;

  role?: InstitutionStaffMembershipRole;

  permissions?: string[];

  status?: InstitutionStaffMembershipStatus;

  invitedByUserId?: Types.ObjectId;
}
