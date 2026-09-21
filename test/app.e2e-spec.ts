/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import {
  DocumentRecord,
  DocumentsRepository,
} from '../src/documents/documents.repository';
import { QueryService } from '../src/query/query.service';

describe('Health endpoint', () => {
  let app: INestApplication;
  let documentsRepository: InMemoryDocumentsRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.LOG_LEVEL = 'debug';
    process.env.API_KEY = 'test-api-key';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '55432';
    process.env.POSTGRES_DB = 'rag_from_zero';
    process.env.POSTGRES_USER = 'postgres';
    process.env.POSTGRES_PASSWORD = 'postgres';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.DATABASE_URL =
      'postgres://postgres:postgres@localhost:55432/rag_from_zero';
    process.env.CORS_ORIGIN = '*';
    process.env.REQUEST_BODY_LIMIT = '1mb';
    process.env.UPLOAD_MAX_FILE_BYTES = `${10 * 1024 * 1024}`;
    process.env.THROTTLE_TTL_SECONDS = '60';
    process.env.THROTTLE_LIMIT = '1000';

    const { AppModule } = await import('../src/app.module');
    documentsRepository = new InMemoryDocumentsRepository();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DocumentsRepository)
      .useValue(documentsRepository)
      .overrideProvider(QueryService)
      .useValue({
        query: (dto: { question: string }) =>
          Promise.resolve({
            question: dto.question,
            answer:
              "I don't have enough retrieved context to answer that question yet.",
            sources: [],
            debug: {
              results: [],
              context: {
                text: '',
                sources: [],
              },
            },
          }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await documentsRepository.deleteAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns service status', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      service: 'rag-from-zero',
      environment: 'test',
    });
  });

  it('POST /documents creates a document record', async () => {
    const response = await request(app.getHttpServer())
      .post('/documents')
      .set('x-api-key', 'test-api-key')
      .send({
        filename: 'policy.md',
        mimeType: 'text/markdown',
        content:
          '# Refund Policy\nCustomers can can request a refund within 30 days.',
        source: 'manual-test',
      })
      .expect(201);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.status).toBe('queued');
    expect(response.body.filename).toBe('policy.md');
    expect(response.body.mimeType).toBe('text/markdown');
  });

  it('POST /documents/upload extracts text from an uploaded file', async () => {
    const response = await request(app.getHttpServer())
      .post('/documents/upload')
      .set('x-api-key', 'test-api-key')
      .field('source', 'upload-test')
      .attach('file', Buffer.from('Uploaded policy text.'), {
        filename: 'uploaded-policy.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.status).toBe('queued');
    expect(response.body.filename).toBe('uploaded-policy.txt');
    expect(response.body.mimeType).toBe('text/plain');
    expect(response.body.source).toBe('upload-test');
  });

  it('Get /documents/:id returns the stored document metadata', async () => {
    const created = await request(app.getHttpServer())
      .post('/documents')
      .set('x-api-key', 'test-api-key')
      .send({
        filename: 'terms.txt',
        mimeType: 'text/plain',
        content: 'Payment is due within 15 days.',
      })
      .expect(201);

    // 1. Let Supertest check the status code response wrapper
    const response = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('x-api-key', 'test-api-key')
      .expect(200);

    // 2. Use Jest's native expect assertion so asymmetric matchers evaluate safely
    expect(response.body).toEqual({
      id: created.body.id,
      status: 'queued',
      filename: 'terms.txt',
      mimeType: 'text/plain',
      source: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('POST /query returns an empty result set when no embedded chunks exist', async () => {
    const response = await request(app.getHttpServer())
      .post('/query')
      .set('x-api-key', 'test-api-key')
      .send({
        question: 'What is the refund policy?',
      })
      .expect(201);

    expect(response.body).toEqual({
      question: 'What is the refund policy?',
      answer:
        "I don't have enough retrieved context to answer that question yet.",
      sources: [],
      debug: {
        results: [],
        context: {
          text: '',
          sources: [],
        },
      },
    });
  });
});

class InMemoryDocumentsRepository {
  private readonly documents = new Map<DocumentRecord['id'], DocumentRecord>();

  create(input: {
    id: string;
    filename: string;
    mimeType: string;
    source?: string;
    status: DocumentRecord['status'];
    rawText: string;
  }): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    const document: DocumentRecord = {
      id: input.id,
      filename: input.filename,
      mimeType: input.mimeType,
      source: input.source ?? null,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.documents.set(document.id, document);

    return Promise.resolve(document);
  }

  findById(id: string): Promise<DocumentRecord | null> {
    return Promise.resolve(this.documents.get(id) ?? null);
  }

  deleteAll(): Promise<void> {
    this.documents.clear();

    return Promise.resolve();
  }

  updateStatus(
    id: string,
    status: DocumentRecord['status'],
  ): Promise<DocumentRecord> {
    const document = this.documents.get(id);

    if (!document) {
      throw new Error(`Document ${id} not found`);
    }

    const updated = {
      ...document,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.documents.set(id, updated);

    return Promise.resolve(updated);
  }
}
