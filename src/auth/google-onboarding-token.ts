import { sign, verify } from 'jsonwebtoken';

import { env } from '../config/env';

type GoogleOnboardingPayload = {
  purpose: 'google-onboarding';
  sub: string;
};

export function createGoogleOnboardingToken(userId: string) {
  return sign(
    {
      purpose: 'google-onboarding',
      sub: userId,
    },
    env.jwtSecret,
    { expiresIn: '15m' as never },
  );
}

export function verifyGoogleOnboardingToken(token: string) {
  const payload = verify(token, env.jwtSecret) as GoogleOnboardingPayload;

  if (payload.purpose !== 'google-onboarding' || !payload.sub) {
    throw new Error('Invalid google onboarding token');
  }

  return payload;
}
