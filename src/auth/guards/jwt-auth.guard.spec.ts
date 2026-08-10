import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { sign } from 'jsonwebtoken';

import { JwtAuthGuard } from './jwt-auth.guard';
import { env } from '../../config/env';

const createExecutionContext = (
  authorization?: string,
  requestOverrides: Record<string, unknown> = {},
): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
        method: 'GET',
        path: '/campaigns',
        ...requestOverrides,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('denies access when a protected route receives no token', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(() => guard.canActivate(createExecutionContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('blocks protected routes when password change is required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const token = sign(
      {
        sub: 'user-1',
        email: 'user@example.com',
        passwordChangeRequired: true,
      },
      env.jwtSecret,
    );

    expect(() =>
      guard.canActivate(createExecutionContext(`Bearer ${token}`)),
    ).toThrow(ForbiddenException);
  });

  it('allows password change route when password change is required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const token = sign(
      {
        sub: 'user-1',
        email: 'user@example.com',
        passwordChangeRequired: true,
      },
      env.jwtSecret,
    );

    expect(
      guard.canActivate(
        createExecutionContext(`Bearer ${token}`, {
          method: 'PATCH',
          path: '/auth/me/password',
        }),
      ),
    ).toBe(true);
  });
});
