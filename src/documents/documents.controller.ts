import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';

import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentParamDto } from './dto/document-param.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async create(@Body() dto: CreateDocumentDto) {
    const document = await this.documentsService.create(dto);

    return toDocumentResponse(document);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('A file field named "file" is required');
    }

    const maxFileBytes = this.configService.getOrThrow<number>(
      'UPLOAD_MAX_FILE_BYTES',
    );

    if (file.size > maxFileBytes) {
      throw new BadRequestException(
        `Uploaded file is too large. Maximum size is ${maxFileBytes} bytes.`,
      );
    }

    const document = await this.documentsService.createFromUploadedFile(
      file,
      dto.source,
    );

    return toDocumentResponse(document);
  }

  @Get(':id')
  async findById(@Param() params: DocumentParamDto) {
    const document = await this.documentsService.findById(params.id);

    return toDocumentResponse(document);
  }
}

function toDocumentResponse(
  document: Awaited<ReturnType<DocumentsService['findById']>>,
) {
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
