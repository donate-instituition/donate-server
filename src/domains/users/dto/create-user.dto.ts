import { Types } from 'mongoose';

import { UserRole, UserStatus, UserType } from '../models';
import type { UserSettings, UserStats } from '../models';

export type UserRoleGrantInput = {
  name: UserRole;
  grantedAt?: Date;
  grantedBy?: {
    source: 'SYSTEM' | 'USER';
    label: string;
    userId?: Types.ObjectId;
  };
};

export class CreateUserDto {
  type?: UserType;

  roles?: Array<UserRole | UserRoleGrantInput>;

  fullName!: string;

  email!: string;

  phone?: string;

  cpf?: string;

  passwordHash!: string;

  passwordChangeRequired?: boolean;

  activationTokenVersion?: string;

  birthDate?: Date;

  profilePhotoUrl?: string;

  bio?: string;

  status?: UserStatus;

  isVerified?: boolean;

  termsAccepted?: boolean;

  acceptedTermsVersion?: string;

  termsAcceptedAt?: Date;

  settings?: UserSettings;

  stats?: UserStats;
}
