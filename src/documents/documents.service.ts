import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { DocumentsQueueService } from '../queues/documents-queue.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentFileExtractorService } from './document-file-extractor.service';
import { DocumentsRepository } from './documents.repository';

type CreateDocumentInput = {
  filename: string;
  mimeType: string;
  content: string;
  source?: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly documentsQueueService: DocumentsQueueService,
    private readonly documentFileExtractorService: DocumentFileExtractorService,
  ) {}

  async create(dto: CreateDocumentDto | CreateDocumentInput) {
    const document = await this.documentsRepository.create({
      id: randomUUID(),
      filename: dto.filename,
      mimeType: dto.mimeType,
      source: dto.source,
      status: 'uploaded',
      rawText: dto.content,
    });

    await this.documentsQueueService.enqueueDocumentProcessing({
      documentId: document.id,
    });

    return this.documentsRepository.updateStatus(document.id, 'queued');
  }

  async createFromUploadedFile(file: Express.Multer.File, source?: string) {
    const extracted = await this.documentFileExtractorService.extract(file);

    return this.create({
      filename: extracted.filename,
      mimeType: extracted.mimeType,
      content: extracted.content,
      source,
    });
  }

  async findById(id: string) {
    const document = await this.documentsRepository.findById(id);

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }
}
