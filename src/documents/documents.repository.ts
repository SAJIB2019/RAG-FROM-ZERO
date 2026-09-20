import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { DatabaseService } from '../database/database.service';
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

type DocumentRow = {
  id: string;
  filename: string;
  mime_type: string;
  source: string | null;
  status: DocumentStatus;
  created_at: Date;
  updated_at: Date;
};

type DocumentTextRow = {
  raw_text: string | null;
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
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: {
    id: string;
    filename: string;
    mimeType: string;
    source?: string;
    status: DocumentStatus;
    rawText: string;
  }): Promise<DocumentRecord> {
    const result = await this.databaseService.query<DocumentRow>(
      `
        INSERT INTO documents (id, filename, mime_type, source, status, raw_text)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, filename, mime_type, source, status, created_at, updated_at
      `,
      [
        input.id,
        input.filename,
        input.mimeType,
        input.source ?? null,
        input.status,
        input.rawText,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const result = await this.databaseService.query<DocumentRow>(
      `
        SELECT id, filename, mime_type, source, status, created_at, updated_at
        FROM documents
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    return row ? this.mapRow(row) : null;
  }

  async deleteAll(): Promise<void> {
    await this.databaseService.query('DELETE FROM documents');
  }

  async findRawTextById(id: string): Promise<string | null> {
    const result = await this.databaseService.query<DocumentTextRow>(
      `
        SELECT raw_text
        FROM documents
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0]?.raw_text ?? null;
  }

  async replaceChunks(chunks: DocumentChunkInput[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const documentId = chunks[0].documentId;

    await this.databaseService.query(
      `
        DELETE FROM document_chunks
        WHERE document_id = $1
      `,
      [documentId],
    );

    for (const chunk of chunks) {
      await this.databaseService.query(
        `
          INSERT INTO document_chunks (
            id,
            document_id,
            chunk_index,
            content,
            token_count,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          randomUUID(),
          chunk.documentId,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          JSON.stringify(chunk.metadata ?? {}),
        ],
      );
    }
  }

  private mapRow(row: DocumentRow): DocumentRecord {
    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      source: row.source,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
  async updateStatus(
    id: string,
    status: DocumentStatus,
  ): Promise<DocumentRecord> {
    const result = await this.databaseService.query<DocumentRow>(
      `
        UPDATE documents
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, filename, mime_type, source, status, created_at, updated_at
      `,
      [id, status],
    );

    return this.mapRow(result.rows[0]);
  }

  async updateChunkEmbedding(input: {
    documentId: string;
    chunkIndex: number;
    embedding: number[];
  }): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE document_chunks
        SET embedding = $3::vector
        WHERE document_id = $1
          AND chunk_index = $2
      `,
      [input.documentId, input.chunkIndex, toVectorSql(input.embedding)],
    );
  }
}

function toVectorSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
