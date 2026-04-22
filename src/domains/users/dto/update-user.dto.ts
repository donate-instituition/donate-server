import { UserRole } from '../models';

export class UpdateUserDto {
  name?: string;

  email?: string;

  passwordHash?: string;

  phone?: string;

  cpf?: string;

  role?: UserRole;

  profileImageUrl?: string;

  isActive?: boolean;
}
