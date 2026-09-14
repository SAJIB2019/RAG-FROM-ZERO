import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { DocumentsQueueService } from '../queues/documents-queue.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly documentsQueueService: DocumentsQueueService,
  ) {}

  async create(dto: CreateDocumentDto) {
    const document = await this.documentsRepository.create({
      id: randomUUID(),
      filename: dto.filename,
      mimeType: dto.mimeType,
      source: dto.source,
      status: 'uploaded',
    });

    await this.documentsQueueService.enqueueDocumentProcessing({
      documentId: document.id,
      content: dto.content,
    });

    return this.documentsRepository.updateStatus(document.id, 'queued');
  }

  async findById(id: string) {
    const document = await this.documentsRepository.findById(id);

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }
}
