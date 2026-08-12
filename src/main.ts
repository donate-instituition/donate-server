import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrettyLogger } from './common/logger';
import { env } from './config/env';

const UPLOAD_BODY_LIMIT = '20mb';

async function bootstrap() {
  const logger = new PrettyLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger,
    rawBody: true,
  });

  app.useBodyParser('json', { limit: UPLOAD_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: UPLOAD_BODY_LIMIT });

  app.useLogger(logger);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Idempotency-Key',
      'X-Idempotency-Scope',
    ],
  });

  app.useGlobalFilters(app.get(AllExceptionsFilter));

  await app.listen(env.port);
  logger.log(`API listening on http://localhost:${env.port}`, 'Bootstrap');
}
void bootstrap();
