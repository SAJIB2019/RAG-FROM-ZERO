import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  constructor(private readonly documentsRepository: DocumentsRepository) {}

  async create(dto: CreateDocumentDto) {
    return this.documentsRepository.create({
      id: randomUUID(),
      filename: dto.filename,
      mimeType: dto.mimeType,
      source: dto.source,
      status: 'uploaded',
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
