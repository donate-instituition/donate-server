import { hash } from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '../config/env';
import { UserRole, UserStatus, UserType } from '../domains/users/models';
import type { UsersService } from '../domains/users/users.service';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './types/authenticated-user.type';

describe('AuthService', () => {
  it('grants access when login credentials are valid', async () => {
    const userId = new Types.ObjectId();
    const passwordHash = await hash('secret-password', 10);
    const publicUser = {
      _id: userId,
      email: 'donor@example.com',
      role: UserRole.DONOR,
      type: UserType.PERSON,
      status: UserStatus.ACTIVE,
    };
    const user = {
      ...publicUser,
      passwordHash,
    };
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
      toPublicUser: jest.fn().mockReturnValue(publicUser),
    } as unknown as UsersService;
    const authService = new AuthService(usersService);

    const response = await authService.login({
      email: 'donor@example.com',
      password: 'secret-password',
    });
    const payload = verify(
      response.accessToken,
      env.jwtSecret,
    ) as AuthenticatedUser;

    expect(response.user).toEqual(publicUser);
    expect(payload.sub).toBe(userId.toString());
    expect(payload.role).toBe(UserRole.DONOR);
    expect(payload.type).toBe(UserType.PERSON);
    expect(payload.status).toBe(UserStatus.ACTIVE);
  });
});
