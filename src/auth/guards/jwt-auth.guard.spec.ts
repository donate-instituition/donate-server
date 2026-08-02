import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';

const createExecutionContext = (authorization?: string): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
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
});
