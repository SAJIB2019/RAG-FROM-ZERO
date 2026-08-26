import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentParamDto } from './dto/document-param.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(@Body() dto: CreateDocumentDto) {
    const document = await this.documentsService.create(dto);

    return {
      id: document.id,
      status: document.status,
      filename: document.filename,
      mimeType: document.mimeType,
      source: document.source ?? null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  @Get(':id')
  async findById(@Param() params: DocumentParamDto) {
    const document = await this.documentsService.findById(params.id);

    return {
      id: document.id,
      status: document.status,
      filename: document.filename,
      mimeType: document.mimeType,
      source: document.source ?? null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
