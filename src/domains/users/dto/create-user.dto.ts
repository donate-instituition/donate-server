import { UserRole } from '../models';

export class CreateUserDto {
  name!: string;

  email!: string;

  passwordHash!: string;

  phone?: string;

  cpf?: string;

  role!: UserRole;

  profileImageUrl?: string;

  isActive?: boolean;
}
