import { UserRole, UserSettings, UserStats, UserStatus, UserType } from '../models';

export class UpdateUserDto {
  type?: UserType;

  role?: UserRole;

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
