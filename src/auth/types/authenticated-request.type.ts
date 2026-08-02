import type { Request } from 'express';

import type { AuthenticatedUser } from './authenticated-user.type';

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
