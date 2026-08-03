import 'dotenv/config';

const getRequiredEnv = (key: string, fallback?: string): string => {
  const value = process.env[key]?.trim();

  if (!value) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`${key} environment variable is required`);
  }

  return value;
};

const getOptionalNumberEnv = (key: string, fallback: number): number => {
  const rawValue = process.env[key]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${key} environment variable must be a valid number`);
  }

  return parsedValue;
};

export const env = {
  serviceName: process.env.SERVICE_NAME?.trim() || 'donate-server',
  serviceVersion:
    process.env.SERVICE_VERSION?.trim() ||
    process.env.npm_package_version ||
    '0.0.1',
  mongodbUri: getRequiredEnv(
    'MONGODB_URI',
    'mongodb://127.0.0.1:27017/elodoar',
  ),
  jwtSecret: getRequiredEnv('JWT_SECRET', 'dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '1d',
  port: getOptionalNumberEnv('PORT', 3000),
  rateLimitWindowMs: getOptionalNumberEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMaxRequests: getOptionalNumberEnv('RATE_LIMIT_MAX_REQUESTS', 120),
  authRateLimitWindowMs: getOptionalNumberEnv(
    'AUTH_RATE_LIMIT_WINDOW_MS',
    60_000,
  ),
  authRateLimitMaxRequests: getOptionalNumberEnv(
    'AUTH_RATE_LIMIT_MAX_REQUESTS',
    10,
  ),
  idempotencyTtlMs: getOptionalNumberEnv(
    'IDEMPOTENCY_TTL_MS',
    24 * 60 * 60 * 1000,
  ),
  emailBrandHeroUrl: process.env.EMAIL_BRAND_HERO_URL?.trim() || '',
  emailBrandLogoUrl: process.env.EMAIL_BRAND_LOGO_URL?.trim() || '',
  emailAccountActivationUrl:
    process.env.EMAIL_ACCOUNT_ACTIVATION_URL?.trim() ||
    'http://localhost:3000/auth/activate-account',
  emailPublicAppUrl: process.env.EMAIL_PUBLIC_APP_URL?.trim() || '',
  emailSupportEmail:
    process.env.EMAIL_SUPPORT_EMAIL?.trim() || 'contato@elodoar.local',
  emailSupportPhone: process.env.EMAIL_SUPPORT_PHONE?.trim() || '',
  rabbitmqUrl: process.env.RABBITMQ_URL?.trim() || '',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE?.trim() || 'donate.jobs',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || '',
  stripeCurrency: process.env.STRIPE_CURRENCY?.trim().toLowerCase() || 'brl',
};
