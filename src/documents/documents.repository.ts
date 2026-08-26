import { Injectable } from '@nestjs/common';

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

@Injectable()
export class DocumentsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: {
    id: string;
    filename: string;
    mimeType: string;
    source?: string;
    status: DocumentStatus;
  }): Promise<DocumentRecord> {
    const result = await this.databaseService.query<DocumentRow>(
      `
        INSERT INTO documents (id, filename, mime_type, source, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, filename, mime_type, source, status, created_at, updated_at
      `,
      [
        input.id,
        input.filename,
        input.mimeType,
        input.source ?? null,
        input.status,
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
}
