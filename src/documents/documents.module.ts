import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  imports: [DatabaseModule, QueuesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository],
})
export class DocumentsModule {}
