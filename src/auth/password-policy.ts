import { BadRequestException } from '@nestjs/common';

export function assertPasswordPolicy(password: string) {
  if (password.length < 8) {
    throw new BadRequestException('Password must have at least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    throw new BadRequestException('Password must contain a lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException('Password must contain an uppercase letter');
  }

  if (!/\d/.test(password)) {
    throw new BadRequestException('Password must contain a number');
  }
}
