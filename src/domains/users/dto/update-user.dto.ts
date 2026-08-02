import { UserRole, UserStatus, UserType } from '../models';
import type { UserRoleGrantInput } from './create-user.dto';
import type { UserSettings, UserStats } from '../models';

export class UpdateUserDto {
  type?: UserType;

  roles?: Array<UserRole | UserRoleGrantInput>;

  fullName?: string;

  email?: string;

  phone?: string;

  cpf?: string;

  passwordHash?: string;

  birthDate?: Date;

  profilePhotoUrl?: string;

  bio?: string;

  status?: UserStatus;

  isVerified?: boolean;

  settings?: UserSettings;

  stats?: UserStats;
}
