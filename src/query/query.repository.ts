import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

export type RetrievedChunk = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
};

type RetrievedChunkRow = {
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  score: string | number;
};

@Injectable()
export class QueryRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly search: SearchService,
  ) {}

  async vectorSearch(input: {
    embedding: number[];
    limit: number;
  }): Promise<RetrievedChunk[]> {
    if (this.search.enabled) return this.search.vectorSearch(input);
    const rows = await this.prismaService.$queryRaw<RetrievedChunkRow[]>`
        SELECT
          dc.document_id,
          d.filename,
          dc.chunk_index,
          dc.content,
          dc.embedding <=> CAST(${toVectorSql(input.embedding)} AS vector) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE dc.embedding IS NOT NULL
          AND d.status = 'completed'
        ORDER BY dc.embedding <=> CAST(${toVectorSql(input.embedding)} AS vector)
        LIMIT ${input.limit}
      `;

    return rows.map((row) => ({
      documentId: row.document_id,
      filename: row.filename,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: Number(row.score),
    }));
  }

  async keywordSearch(input: {
    query: string;
    limit: number;
  }): Promise<RetrievedChunk[]> {
    if (this.search.enabled) return this.search.keywordSearch(input);
    const rows = await this.prismaService.$queryRaw<RetrievedChunkRow[]>`
        SELECT
          dc.document_id,
          d.filename,
          dc.chunk_index,
          dc.content,
          ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', ${input.query})) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE dc.search_vector @@ websearch_to_tsquery('english', ${input.query})
          AND d.status = 'completed'
        ORDER BY score DESC
        LIMIT ${input.limit}
      `;

    return rows.map((row) => ({
      documentId: row.document_id,
      filename: row.filename,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: Number(row.score),
    }));
  }
}

function toVectorSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
