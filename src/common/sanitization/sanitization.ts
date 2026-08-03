type SanitizationOptions = {
  maxStringLength?: number;
  redactValue?: string;
};

export type ExternalApiRequestLog = {
  body?: unknown;
  headers?: Record<string, unknown>;
  method?: string;
  query?: unknown;
  url?: string;
};

export type ExternalApiResponseLog = {
  body?: unknown;
  headers?: Record<string, unknown>;
  statusCode?: number;
};

const DEFAULT_REDACT_VALUE = '[REDACTED]';
const DEFAULT_MAX_STRING_LENGTH = 2_000;

const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /^token$/i,
  /secret/i,
  /password/i,
  /passwordHash/i,
  /^cpf$/i,
  /^cnpj$/i,
  /card[-_]?number/i,
  /cvv/i,
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeString(value: string, options: Required<SanitizationOptions>) {
  if (value.length <= options.maxStringLength) {
    return value;
  }

  return `${value.slice(0, options.maxStringLength)}...[TRUNCATED]`;
}

function normalizeOptions(options?: SanitizationOptions) {
  return {
    maxStringLength: options?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    redactValue: options?.redactValue ?? DEFAULT_REDACT_VALUE,
  };
}

function sanitizeUrl(
  url: string | undefined,
  options: Required<SanitizationOptions>,
) {
  if (!url) {
    return url;
  }

  try {
    const parsedUrl = new URL(url, 'http://local.request');

    parsedUrl.username = parsedUrl.username ? options.redactValue : '';
    parsedUrl.password = parsedUrl.password ? options.redactValue : '';

    for (const key of Array.from(parsedUrl.searchParams.keys())) {
      if (isSensitiveKey(key)) {
        parsedUrl.searchParams.set(key, options.redactValue);
      }
    }

    const sanitizedUrl = url.startsWith('http')
      ? parsedUrl.toString()
      : `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

    return sanitizeString(sanitizedUrl, options);
  } catch {
    return sanitizeString(url, options);
  }
}

export function sanitizeValue(
  value: unknown,
  options?: SanitizationOptions,
): unknown {
  const normalizedOptions = normalizeOptions(options);

  if (typeof value === 'string') {
    return sanitizeString(value, normalizedOptions);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, normalizedOptions));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>(
    (acc, [key, entry]) => {
      if (isSensitiveKey(key)) {
        acc[key] = normalizedOptions.redactValue;
        return acc;
      }

      acc[key] = sanitizeValue(entry, normalizedOptions);
      return acc;
    },
    {},
  );
}

export function sanitizeExternalApiRequest(
  request: ExternalApiRequestLog,
  options?: SanitizationOptions,
): ExternalApiRequestLog {
  const normalizedOptions = normalizeOptions(options);

  return {
    method: request.method,
    url: sanitizeUrl(request.url, normalizedOptions),
    headers: sanitizeValue(request.headers, normalizedOptions) as Record<
      string,
      unknown
    >,
    query: sanitizeValue(request.query, normalizedOptions),
    body: sanitizeValue(request.body, normalizedOptions),
  };
}

export function sanitizeExternalApiResponse(
  response: ExternalApiResponseLog,
  options?: SanitizationOptions,
): ExternalApiResponseLog {
  return {
    statusCode: response.statusCode,
    headers: sanitizeValue(response.headers, options) as Record<
      string,
      unknown
    >,
    body: sanitizeValue(response.body, options),
  };
}
