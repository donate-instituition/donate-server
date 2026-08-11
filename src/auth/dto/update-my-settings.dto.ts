import { UserRole } from '../../domains/users/models';

export class UpdateMySettingsNotificationsDto {
  donations?: boolean;

  campaigns?: boolean;

  conversations?: boolean;

  emailDigestEnabled?: boolean;
}

export class UpdateMySettingsDto {
  preferredRole?: UserRole;

  notifications?: UpdateMySettingsNotificationsDto;
}
