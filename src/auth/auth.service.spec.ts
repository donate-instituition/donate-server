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
      type: UserType.PERSON,
      status: UserStatus.ACTIVE,
      roles: [
        {
          name: UserRole.DONOR,
          grantedAt: new Date('2026-08-02T00:00:00.000Z'),
          grantedBy: {
            source: 'SYSTEM',
            label: 'sistema',
          },
        },
      ],
    };
    const user = {
      ...publicUser,
      _id: userId,
      passwordHash,
      fullName: 'Donor Example',
      name: 'Donor Example',
    };
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
      toPublicUser: jest.fn().mockReturnValue(publicUser),
    } as unknown as UsersService;
    const refreshTokenSessionModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const authService = new AuthService(usersService, refreshTokenSessionModel as never);

    const response = await authService.login({
      email: 'donor@example.com',
      password: 'secret-password',
    });
    const payload = verify(
      response.accessToken,
      env.jwtSecret,
    ) as AuthenticatedUser;

    expect(response.user).toEqual(
      expect.objectContaining({
        id: userId.toString(),
        name: 'Donor Example',
        email: 'donor@example.com',
        roles: [
          expect.objectContaining({
            name: 'donor',
            grantedBy: {
              source: 'SYSTEM',
              label: 'sistema',
            },
          }),
        ],
      }),
    );
    expect(payload.sub).toBe(userId.toString());
    expect(payload.roles).toEqual([UserRole.DONOR]);
    expect(payload.type).toBe(UserType.PERSON);
    expect(payload.status).toBe(UserStatus.ACTIVE);
  });
});
