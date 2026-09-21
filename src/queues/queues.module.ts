import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DocumentsQueueService } from './documents-queue.service';
import { DOCUMENT_PROCESSING_QUEUE } from './queue.constants';

const isTestEnvironment = process.env.NODE_ENV === 'test';
const bullQueueImports = isTestEnvironment
  ? []
  : [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT'),
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
            tls: configService.getOrThrow<boolean>('REDIS_TLS')
              ? {}
              : undefined,
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
          },
        }),
      }),
      BullModule.registerQueue({
        name: DOCUMENT_PROCESSING_QUEUE,
      }),
    ];

@Module({
  imports: bullQueueImports,
  providers: [
    isTestEnvironment
      ? {
          provide: DocumentsQueueService,
          useValue: {
            enqueueDocumentProcessing: () => Promise.resolve(),
          },
        }
      : DocumentsQueueService,
  ],
  exports: isTestEnvironment
    ? [DocumentsQueueService]
    : [BullModule, DocumentsQueueService],
})
export class QueuesModule {}
