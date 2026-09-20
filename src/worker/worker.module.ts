import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from '../config/env.schema';
import { DatabaseModule } from '../database/database.module';
import { DocumentsRepository } from '../documents/documents.repository';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { QueuesModule } from '../queues/queues.module';
import { DocumentProcessingProcessor } from './document-processing.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    DatabaseModule,
    QueuesModule,
    EmbeddingsModule,
  ],
  providers: [DocumentsRepository, DocumentProcessingProcessor],
})
export class WorkerModule {}
