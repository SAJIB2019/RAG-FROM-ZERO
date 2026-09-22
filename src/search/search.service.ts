import { Client } from '@elastic/elasticsearch';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PrismaService } from '../prisma/prisma.service';
import type { RetrievedChunk } from '../query/query.repository';

type IndexedChunk = { id: string; content: string; embedding: string | null };
type SearchHit = { id: string; score: number };

@Injectable()
export class SearchService implements OnModuleDestroy {
  readonly enabled: boolean;
  private readonly qdrant: QdrantClient;
  private readonly elastic: Client;
  private readonly collection: string;
  private readonly index: string;
  private readonly dimensions: number;
  private initialization?: Promise<void>;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled =
      config.get<string>('SEARCH_BACKEND') === 'qdrant-elasticsearch';
    this.collection = config.getOrThrow<string>('QDRANT_COLLECTION');
    this.index = config.getOrThrow<string>('ELASTICSEARCH_INDEX');
    this.dimensions = config.getOrThrow<number>('EMBEDDING_DIMENSIONS');
    this.qdrant = new QdrantClient({
      url: config.getOrThrow<string>('QDRANT_URL'),
      apiKey: config.get<string>('QDRANT_API_KEY') || undefined,
      timeout: 30000,
      checkCompatibility: false,
    });
    const apiKey = config.get<string>('ELASTICSEARCH_API_KEY');
    this.elastic = new Client({
      node: config.getOrThrow<string>('ELASTICSEARCH_URL'),
      ...(apiKey ? { auth: { apiKey } } : {}),
      requestTimeout: 30000,
      maxRetries: 2,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.elastic.close();
  }

  async checkReadiness(): Promise<void> {
    if (!this.enabled) return;
    await Promise.all([
      this.qdrant.getCollection(this.collection),
      this.elastic.indices.get({ index: this.index }),
    ]);
  }

  async ensureIndexes(): Promise<void> {
    if (!this.enabled) return;
    this.initialization ??= this.createIndexes().catch((error: unknown) => {
      this.initialization = undefined;
      throw error;
    });
    await this.initialization;
  }

  private async createIndexes(): Promise<void> {
    if (!(await this.qdrant.collectionExists(this.collection)).exists) {
      try {
        await this.qdrant.createCollection(this.collection, {
          vectors: { size: this.dimensions, distance: 'Cosine' },
        });
      } catch (error) {
        // Another worker may have created it concurrently.
        if (!(await this.qdrant.collectionExists(this.collection)).exists)
          throw error;
      }
    }
    const info = await this.qdrant.getCollection(this.collection);
    const vectors = info.config.params.vectors;
    if (
      !vectors ||
      !('size' in vectors) ||
      vectors.size !== this.dimensions ||
      vectors.distance !== 'Cosine'
    ) {
      throw new Error(
        'Qdrant collection must use the configured embedding dimensions and Cosine distance',
      );
    }
    if (!(await this.elastic.indices.exists({ index: this.index }))) {
      try {
        await this.elastic.indices.create({
          index: this.index,
          mappings: {
            properties: {
              documentId: { type: 'keyword' },
              content: { type: 'text', analyzer: 'english' },
            },
          },
        });
      } catch (error) {
        if (!(await this.elastic.indices.exists({ index: this.index })))
          throw error;
      }
    }
  }

  async syncDocument(documentId: string): Promise<void> {
    if (!this.enabled) return;
    await this.ensureIndexes();
    const chunks = await this.prisma.$queryRaw<IndexedChunk[]>`
      SELECT id, content, embedding::text AS embedding
      FROM document_chunks WHERE document_id = ${documentId}::uuid ORDER BY chunk_index
    `;
    // Validate before changing either index. Retries replace the whole document.
    const points = chunks.map((chunk) => {
      const vector: unknown = chunk.embedding
        ? JSON.parse(chunk.embedding)
        : null;
      if (
        !Array.isArray(vector) ||
        vector.length !== this.dimensions ||
        !vector.every(
          (value: unknown) =>
            typeof value === 'number' && Number.isFinite(value),
        )
      ) {
        throw new Error(`Missing or invalid embedding for chunk ${chunk.id}`);
      }
      return {
        id: chunk.id,
        vector: vector as number[],
        payload: { documentId },
      };
    });
    await this.qdrant.delete(this.collection, {
      wait: true,
      filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
    });
    const deleted = await this.elastic.deleteByQuery({
      index: this.index,
      query: { term: { documentId } },
      refresh: true,
    });
    if (deleted.timed_out || (deleted.failures?.length ?? 0) > 0) {
      throw new Error(
        `Elasticsearch cleanup failed for document ${documentId}`,
      );
    }
    for (let offset = 0; offset < chunks.length; offset += 100) {
      await this.qdrant.upsert(this.collection, {
        wait: true,
        points: points.slice(offset, offset + 100),
      });
      const result = await this.elastic.bulk({
        refresh: 'wait_for',
        operations: chunks
          .slice(offset, offset + 100)
          .flatMap((chunk) => [
            { index: { _index: this.index, _id: chunk.id } },
            { documentId, content: chunk.content },
          ]),
      });
      if (result.errors)
        throw new Error(
          `Elasticsearch indexing failed for document ${documentId}`,
        );
    }
  }

  async vectorSearch(input: {
    embedding: number[];
    limit: number;
  }): Promise<RetrievedChunk[]> {
    const result = await this.qdrant.query(this.collection, {
      query: input.embedding,
      limit: input.limit * 3,
      with_payload: false,
    });
    return this.hydrate(
      result.points.map((point) => ({
        id: String(point.id),
        score: 1 - point.score,
      })),
      input.limit,
    );
  }

  async keywordSearch(input: {
    query: string;
    limit: number;
  }): Promise<RetrievedChunk[]> {
    const result = await this.elastic.search({
      index: this.index,
      size: input.limit * 3,
      query: { match: { content: input.query } },
      _source: false,
    });
    return this.hydrate(
      result.hits.hits.flatMap((hit) =>
        hit._id
          ? [
              {
                id: hit._id,
                score: hit._score ?? 0,
              },
            ]
          : [],
      ),
      input.limit,
    );
  }

  private async hydrate(
    hits: SearchHit[],
    limit: number,
  ): Promise<RetrievedChunk[]> {
    if (hits.length === 0) return [];
    // PostgreSQL is authoritative: never serve stale chunks or incomplete documents.
    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        id: { in: hits.map((hit) => hit.id) },
        document: { status: 'completed' },
      },
      include: { document: { select: { filename: true } } },
    });
    const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    return hits
      .flatMap((hit) => {
        const chunk = byId.get(hit.id);
        return chunk
          ? [
              {
                documentId: chunk.documentId,
                filename: chunk.document.filename,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                score: hit.score,
              },
            ]
          : [];
      })
      .slice(0, limit);
  }
}
