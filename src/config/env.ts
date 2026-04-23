import 'dotenv/config';

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();

  if (!value) {
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
  mongodbUri: getRequiredEnv('MONGODB_URI'),
  port: getOptionalNumberEnv('PORT', 3000),
};
