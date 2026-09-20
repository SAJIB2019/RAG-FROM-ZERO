import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const bodyLimit = configService.getOrThrow<string>('REQUEST_BODY_LIMIT');

  app.enableShutdownHooks();
  app.enableCors({
    origin: parseCorsOrigin(configService.getOrThrow<string>('CORS_ORIGIN')),
  });
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(compression());
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.setGlobalPrefix('api');
  app.useLogger(parseLogLevels(configService.getOrThrow<string>('LOG_LEVEL')));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);

  Logger.log(`API server listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();

function parseCorsOrigin(origin: string): boolean | string | string[] {
  if (origin === '*') {
    return true;
  }

  return origin.split(',').map((value) => value.trim());
}

function parseLogLevels(
  level: string,
): Array<'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose'> {
  const levels = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'] as const;
  const index = levels.indexOf(level as (typeof levels)[number]);

  return levels.slice(0, index + 1);
}
