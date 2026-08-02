import { UserRole } from '../../domains/users/models';

export class UpdateMySettingsDto {
  preferredRole?: UserRole;
}
