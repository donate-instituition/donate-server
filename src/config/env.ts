import 'dotenv/config';

type AppEnvironment =
  | 'local'
  | 'development'
  | 'preview'
  | 'production'
  | 'test';

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

const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim();

  return value || undefined;
};

const getAppEnvironment = (): AppEnvironment => {
  const rawValue = (process.env.APP_ENV || process.env.NODE_ENV || 'local')
    .trim()
    .toLowerCase();

  if (rawValue === 'prod') {
    return 'production';
  }

  if (rawValue === 'dev') {
    return 'development';
  }

  if (
    rawValue === 'local' ||
    rawValue === 'development' ||
    rawValue === 'preview' ||
    rawValue === 'production' ||
    rawValue === 'test'
  ) {
    return rawValue;
  }

  return 'local';
};

const defaultMongoDatabaseByEnvironment: Record<AppEnvironment, string> = {
  local: 'test',
  development: 'test',
  preview: 'test',
  production: 'prod',
  test: 'test',
};

const appendMongoDatabase = (clusterUri: string, database: string): string => {
  const normalizedDatabase = database.replace(/^\/+/, '').replace(/\/+$/, '');

  try {
    const url = new URL(clusterUri);
    url.pathname = `/${normalizedDatabase}`;

    return url.toString();
  } catch {
    const queryIndex = clusterUri.indexOf('?');
    const uriWithoutQuery =
      queryIndex >= 0 ? clusterUri.slice(0, queryIndex) : clusterUri;
    const query = queryIndex >= 0 ? clusterUri.slice(queryIndex) : '';

    return `${uriWithoutQuery.replace(/\/+$/, '')}/${normalizedDatabase}${query}`;
  }
};

const appEnvironment = getAppEnvironment();
const mongodbDatabase =
  getOptionalEnv('MONGODB_DATABASE') ||
  defaultMongoDatabaseByEnvironment[appEnvironment];
const mongodbClusterUri =
  getOptionalEnv('MONGODB_CLUSTER_URI') || 'mongodb://127.0.0.1:27017';
const mongodbUri =
  getOptionalEnv('MONGODB_URI') ||
  appendMongoDatabase(mongodbClusterUri, mongodbDatabase);

export const env = {
  appEnvironment,
  serviceName: process.env.SERVICE_NAME?.trim() || 'donate-server',
  serviceVersion:
    process.env.SERVICE_VERSION?.trim() ||
    process.env.npm_package_version ||
    '0.0.1',
  mongodbDatabase,
  mongodbUri,
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
    'http://localhost:3000/activate-account',
  emailPublicAppUrl: process.env.EMAIL_PUBLIC_APP_URL?.trim() || '',
  emailSupportEmail:
    process.env.EMAIL_SUPPORT_EMAIL?.trim() || 'contato@elodoar.local',
  emailSupportPhone: process.env.EMAIL_SUPPORT_PHONE?.trim() || '',
  rabbitmqUrl: process.env.RABBITMQ_URL?.trim() || '',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE?.trim() || 'donate.jobs',
  redisUrl: process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379',
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX?.trim() || 'donate:',
  feedCacheTtlSeconds: getOptionalNumberEnv('FEED_CACHE_TTL_SECONDS', 30),
  campaignCacheTtlSeconds: getOptionalNumberEnv(
    'CAMPAIGN_CACHE_TTL_SECONDS',
    300,
  ),
  campaignsListCacheTtlSeconds: getOptionalNumberEnv(
    'CAMPAIGNS_LIST_CACHE_TTL_SECONDS',
    60,
  ),
  institutionCacheTtlSeconds: getOptionalNumberEnv(
    'INSTITUTION_CACHE_TTL_SECONDS',
    300,
  ),
  countersFlushIntervalMs: getOptionalNumberEnv(
    'COUNTERS_FLUSH_INTERVAL_MS',
    20_000,
  ),
  passwordResetTtlSeconds: getOptionalNumberEnv(
    'PASSWORD_RESET_TTL_SECONDS',
    15 * 60,
  ),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || '',
  stripeCurrency: process.env.STRIPE_CURRENCY?.trim().toLowerCase() || 'brl',
  stripeServiceFeeBps: getOptionalNumberEnv('STRIPE_SERVICE_FEE_BPS', 0),
  objectStorageDriver: process.env.OBJECT_STORAGE_DRIVER?.trim() || 'local',
  objectStorageSignedUrlTtlSeconds: getOptionalNumberEnv(
    'OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS',
    5 * 60,
  ),
  s3Region: process.env.S3_REGION?.trim() || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET?.trim() || '',
  s3Endpoint: process.env.S3_ENDPOINT?.trim() || '',
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE?.trim() === 'true',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || '',
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID?.trim() || '',
};
