import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PrismaModule } from '../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { DocumentFileExtractorService } from './document-file-extractor.service';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    PrismaModule,
    QueuesModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.getOrThrow<number>('UPLOAD_MAX_FILE_BYTES'),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentsRepository,
    DocumentFileExtractorService,
  ],
})
export class DocumentsModule {}
