import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';

import { env } from '../../config/env';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication token is invalid');
    }

    try {
      request.user = verify(token, env.jwtSecret) as AuthenticatedUser;
    } catch {
      throw new UnauthorizedException('Authentication token is invalid');
    }

    if (request.user.passwordChangeRequired && !this.isPasswordChangeRoute(request)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required',
      });
    }

    return true;
  }

  private isPasswordChangeRoute(request: AuthenticatedRequest) {
    const path = request.path ?? request.url ?? '';
    return request.method === 'PATCH' && path.includes('/auth/me/password');
  }
}
