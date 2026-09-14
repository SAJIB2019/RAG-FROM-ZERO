import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker/worker.module';

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  Logger.log('Document worker started', 'Worker');
}

void bootstrap();
