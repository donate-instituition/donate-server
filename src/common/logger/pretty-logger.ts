import type { LoggerService, LogLevel } from '@nestjs/common';

type LoggerMetadata = Record<string, unknown>;

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

const levelWeight: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
  fatal: 0,
};

const levelLabel: Record<LogLevel, string> = {
  error: 'ERROR',
  warn: 'WARN',
  log: 'INFO',
  debug: 'DEBUG',
  verbose: 'TRACE',
  fatal: 'FATAL',
};

const levelColor: Record<LogLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  log: '\x1b[32m',
  debug: '\x1b[36m',
  verbose: '\x1b[90m',
  fatal: '\x1b[35m',
};

const resetColor = '\x1b[0m';
const dimColor = '\x1b[2m';

function getConfiguredLogLevel(): LogLevel {
  const rawLevel = process.env.LOG_LEVEL?.toLowerCase();

  if (rawLevel === 'info') {
    return 'log';
  }

  if (rawLevel && LOG_LEVELS.includes(rawLevel as LogLevel)) {
    return rawLevel as LogLevel;
  }

  return process.env.NODE_ENV === 'production' ? 'log' : 'debug';
}

function formatMetadata(metadata?: LoggerMetadata) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '';
  }

  return ` ${dimColor}${JSON.stringify(metadata)}${resetColor}`;
}

function normalizeContext(context?: string) {
  return context ? `${dimColor}[${context}]${resetColor} ` : '';
}

export class PrettyLogger implements LoggerService {
  private readonly minLevel = getConfiguredLogLevel();

  debug(message: unknown, context?: string, metadata?: LoggerMetadata) {
    this.write('debug', message, context, metadata);
  }

  error(
    message: unknown,
    trace?: string,
    context?: string,
    metadata?: LoggerMetadata,
  ) {
    this.write('error', message, context, metadata, trace);
  }

  fatal(
    message: unknown,
    trace?: string,
    context?: string,
    metadata?: LoggerMetadata,
  ) {
    this.write('fatal', message, context, metadata, trace);
  }

  log(message: unknown, context?: string, metadata?: LoggerMetadata) {
    this.write('log', message, context, metadata);
  }

  verbose(message: unknown, context?: string, metadata?: LoggerMetadata) {
    this.write('verbose', message, context, metadata);
  }

  warn(message: unknown, context?: string, metadata?: LoggerMetadata) {
    this.write('warn', message, context, metadata);
  }

  private shouldLog(level: LogLevel) {
    return levelWeight[level] <= levelWeight[this.minLevel];
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    metadata?: LoggerMetadata,
    trace?: string,
  ) {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const color = levelColor[level];
    const label = levelLabel[level].padEnd(5);
    const line = `${dimColor}${timestamp}${resetColor} ${color}${label}${resetColor} ${normalizeContext(context)}${String(message)}${formatMetadata(metadata)}`;

    if (level === 'error' || level === 'fatal') {
      console.error(line);

      if (trace) {
        console.error(`${dimColor}${trace}${resetColor}`);
      }

      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  }
}
