import { UserAllowMessagesFrom, UserRole } from '../enums';

import type { UserNotificationSettings } from './user-notification-settings.interface';

export interface UserSettings {
  privateProfile?: boolean;
  allowMessagesFrom?: UserAllowMessagesFrom;
  preferredRole?: UserRole;
  notifications?: UserNotificationSettings;
}
