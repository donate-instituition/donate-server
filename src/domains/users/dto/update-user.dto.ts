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

  googleId?: string;

  passwordChangeRequired?: boolean;

  activationTokenVersion?: string | null;

  birthDate?: Date;

  profilePhotoUrl?: string;

  bio?: string;

  status?: UserStatus;

  isVerified?: boolean;

  termsAccepted?: boolean;

  acceptedTermsVersion?: string | null;

  termsAcceptedAt?: Date | null;

  settings?: UserSettings;

  stats?: UserStats;
}
