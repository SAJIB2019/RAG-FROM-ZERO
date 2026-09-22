import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

function setup(backend = 'qdrant-elasticsearch') {
  const prisma = {
    $queryRaw: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'Refund within 30 days.',
        embedding: '[1,0]',
      },
    ]),
    documentChunk: {
      findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'canonical text',
          document: { filename: 'policy.txt' },
        },
      ]),
    },
  };
  const qdrant = {
    collectionExists: jest
      .fn()
      .mockReturnValue(Promise.resolve({ exists: true })),
    getCollection: jest.fn().mockReturnValue(
      Promise.resolve({
        config: { params: { vectors: { size: 2, distance: 'Cosine' } } },
      }),
    ),
    delete: jest.fn().mockReturnValue(Promise.resolve({})),
    upsert: jest.fn().mockReturnValue(Promise.resolve({})),
    query: jest.fn().mockReturnValue(
      Promise.resolve({
        points: [
          { id: 'stale-chunk', score: 0.99 },
          { id: 'chunk-1', score: 0.9 },
        ],
      }),
    ),
  };
  const elastic = {
    indices: { exists: jest.fn().mockReturnValue(Promise.resolve(true)) },
    deleteByQuery: jest.fn().mockReturnValue(Promise.resolve({})),
    bulk: jest
      .fn<() => Promise<{ errors: boolean }>>()
      .mockResolvedValue({ errors: false }),
    search: jest
      .fn()
      .mockReturnValue(
        Promise.resolve({ hits: { hits: [{ _id: 'chunk-1', _score: 2 }] } }),
      ),
  };
  const service = new SearchService(
    new ConfigService({
      SEARCH_BACKEND: backend,
      QDRANT_URL: 'http://localhost:6333',
      QDRANT_COLLECTION: 'test',
      ELASTICSEARCH_URL: 'http://localhost:9200',
      ELASTICSEARCH_INDEX: 'test',
      EMBEDDING_DIMENSIONS: 2,
    }),
    prisma as unknown as PrismaService,
  );
  Object.assign(service, { qdrant, elastic });
  return { service, prisma, qdrant, elastic };
}

describe('external search consistency', () => {
  it('hydrates authoritative content and excludes stale hits while preserving rank', async () => {
    const { service, prisma } = setup();
    const hits = await service.vectorSearch({ embedding: [1, 0], limit: 10 });
    expect(hits).toHaveLength(1);
    expect(hits[0].content).toBe('canonical text');
    expect(hits[0].score).toBeCloseTo(0.1);
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['stale-chunk', 'chunk-1'] },
          document: { status: 'completed' },
        },
      }),
    );
  });

  it('uses Elasticsearch lexical ranking and canonical chunk metadata', async () => {
    const { service, elastic } = setup();
    expect(await service.keywordSearch({ query: 'refund', limit: 5 })).toEqual([
      {
        documentId: 'doc-1',
        filename: 'policy.txt',
        chunkIndex: 0,
        content: 'canonical text',
        score: 2,
      },
    ]);
    expect(elastic.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: { match: { content: 'refund' } } }),
    );
  });

  it('rejects invalid dimensions before deleting existing indexes', async () => {
    const { service, prisma, qdrant, elastic } = setup();
    prisma.$queryRaw.mockResolvedValue([{ id: 'bad', embedding: '[1]' }]);
    await expect(service.syncDocument('doc-1')).rejects.toThrow(
      'invalid embedding',
    );
    expect(qdrant.delete).not.toHaveBeenCalled();
    expect(elastic.deleteByQuery).not.toHaveBeenCalled();
  });

  it('surfaces partial bulk failures and permits an idempotent retry', async () => {
    const { service, elastic, qdrant } = setup();
    elastic.bulk.mockResolvedValueOnce({ errors: true });
    await expect(service.syncDocument('doc-1')).rejects.toThrow(
      'indexing failed',
    );
    await service.syncDocument('doc-1');
    expect(qdrant.delete).toHaveBeenCalledTimes(2);
    expect(qdrant.upsert).toHaveBeenLastCalledWith('test', {
      wait: true,
      points: [
        { id: 'chunk-1', vector: [1, 0], payload: { documentId: 'doc-1' } },
      ],
    });
  });

  it('does not contact external services when PostgreSQL is selected', async () => {
    const { service, qdrant, prisma } = setup('postgres');
    await service.syncDocument('doc-1');
    await service.checkReadiness();
    expect(qdrant.collectionExists).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
