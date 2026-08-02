import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';

import { env } from '../config/env';
import { UsersService } from '../domains/users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  private toSessionUser(user: {
    _id?: { toString(): string };
    fullName?: string;
    name?: string;
    email: string;
    role: string;
  }) {
    const roleMap: Record<string, string> = {
      PLATFORM_ADMIN: 'platform-admin',
      DONOR: 'donor',
      INSTITUTION_STAFF: 'institution-staff',
    };

    return {
      id: user._id?.toString() ?? 'pending',
      name: user.fullName ?? user.name ?? user.email,
      email: user.email,
      role: roleMap[user.role] ?? 'donor',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await compare(loginDto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      type: user.type,
      status: user.status,
    };

    const accessToken = sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as never,
    });

    return {
      token: accessToken,
      accessToken,
      user: this.toSessionUser(user),
    };
  }

  async register(registerDto: RegisterDto) {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const createdUser = await this.usersService.create({
      fullName: registerDto.name,
      email: normalizedEmail,
      passwordHash: await hash(registerDto.password, 10),
      role: 'DONOR' as never,
      type: 'PERSON' as never,
      status: 'ACTIVE' as never,
    });

    const payload = {
      sub: createdUser._id.toString(),
      email: createdUser.email,
      role: createdUser.role,
      type: createdUser.type,
      status: createdUser.status,
    };

    const accessToken = sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as never,
    });

    return {
      token: accessToken,
      accessToken,
      user: this.toSessionUser(createdUser),
    };
  }

  forgotPassword(body: { email: string }) {
    return {
      message:
        'Se existir uma conta com este e-mail, enviaremos instruções para redefinição.',
    };
  }
}
