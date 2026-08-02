import { SetMetadata } from '@nestjs/common';

import { UserRole } from '../../domains/users/models';
import { ROLES_KEY } from '../constants/auth.constants';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
