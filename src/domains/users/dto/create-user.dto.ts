import {
  UserRole,
  UserStatus,
  UserType,
} from '../models';
import type { UserSettings, UserStats } from '../models';

export class CreateUserDto {
  type?: UserType;

  role!: UserRole;

  fullName!: string;

  email!: string;

  phone?: string;

  cpf?: string;

  passwordHash!: string;

  birthDate?: Date;

  profilePhotoUrl?: string;

  bio?: string;

  status?: UserStatus;

  isVerified?: boolean;

  settings?: UserSettings;

  stats?: UserStats;
}
