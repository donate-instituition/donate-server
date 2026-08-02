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
  serviceVersion: process.env.SERVICE_VERSION?.trim() || process.env.npm_package_version || '0.0.1',
  mongodbUri: getRequiredEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/elodoar'),
  jwtSecret: getRequiredEnv('JWT_SECRET', 'dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '1d',
  port: getOptionalNumberEnv('PORT', 3000),
};
