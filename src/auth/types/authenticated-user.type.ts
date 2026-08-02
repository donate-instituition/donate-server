import { UserRole, UserStatus, UserType } from '../../domains/users/models';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  roles: UserRole[];
  type: UserType;
  status: UserStatus;
};
