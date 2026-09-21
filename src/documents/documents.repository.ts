import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Prisma, Document as PrismaDocument } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStatus } from './types/document-status.type';

export type DocumentRecord = {
  id: string;
  filename: string;
  mimeType: string;
  source: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type DocumentChunkInput = {
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(input: {
    id: string;
    filename: string;
    mimeType: string;
    source?: string;
    status: DocumentStatus;
    rawText: string;
  }): Promise<DocumentRecord> {
    const document = await this.prismaService.document.create({
      data: {
        id: input.id,
        filename: input.filename,
        mimeType: input.mimeType,
        source: input.source ?? null,
        status: input.status,
        rawText: input.rawText,
      },
    });

    return this.mapDocument(document);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const document = await this.prismaService.document.findUnique({
      where: {
        id,
      },
    });

    return document ? this.mapDocument(document) : null;
  }

  async deleteAll(): Promise<void> {
    await this.prismaService.document.deleteMany();
  }

  async findRawTextById(id: string): Promise<string | null> {
    const document = await this.prismaService.document.findUnique({
      where: {
        id,
      },
      select: {
        rawText: true,
      },
    });

    return document?.rawText ?? null;
  }

  async replaceChunks(chunks: DocumentChunkInput[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const documentId = chunks[0].documentId;

    await this.prismaService.$transaction([
      this.prismaService.documentChunk.deleteMany({
        where: {
          documentId,
        },
      }),
      this.prismaService.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          id: randomUUID(),
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: toPrismaJson(chunk.metadata ?? {}),
        })),
      }),
    ]);
  }

  private mapDocument(document: PrismaDocument): DocumentRecord {
    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      source: document.source,
      status: document.status as DocumentStatus,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
  ): Promise<DocumentRecord> {
    const document = await this.prismaService.document.update({
      where: {
        id,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return this.mapDocument(document);
  }

  async updateChunkEmbedding(input: {
    documentId: string;
    chunkIndex: number;
    embedding: number[];
  }): Promise<void> {
    await this.prismaService.$executeRaw`
        UPDATE document_chunks
        SET embedding = ${toVectorSql(input.embedding)}::vector
        WHERE document_id = ${input.documentId}::uuid
          AND chunk_index = ${input.chunkIndex}
      `;
  }
}

function toVectorSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}
