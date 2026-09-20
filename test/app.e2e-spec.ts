/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { DocumentsRepository } from '../src/documents/documents.repository';
describe('Health endpoint', () => {
  let app: INestApplication;
  let documentsRepository: DocumentsRepository;

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
    process.env.THROTTLE_TTL_SECONDS = '60';
    process.env.THROTTLE_LIMIT = '1000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    documentsRepository = app.get(DocumentsRepository);
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
