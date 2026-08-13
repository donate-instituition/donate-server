import { sign, verify } from 'jsonwebtoken';

import { env } from '../config/env';

type AccountActivationPayload = {
  purpose: 'activate-account';
  sub: string;
  version: string;
};

export function createAccountActivationToken(userId: string, version: string) {
  return sign(
    {
      purpose: 'activate-account',
      sub: userId,
      version,
    },
    env.jwtSecret,
    { expiresIn: '2d' as never },
  );
}

export function createAccountActivationUrl(
  userId: string,
  version: string,
  baseUrl = env.emailAccountActivationUrl ||
    'http://localhost:3000/activate-account',
) {
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}token=${encodeURIComponent(createAccountActivationToken(userId, version))}`;
}

export function verifyAccountActivationToken(token: string) {
  const payload = verify(token, env.jwtSecret) as AccountActivationPayload;

  if (
    payload.purpose !== 'activate-account' ||
    !payload.sub ||
    !payload.version
  ) {
    throw new Error('Invalid account activation token');
  }

  return payload;
}
