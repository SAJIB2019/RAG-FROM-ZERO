import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose'])
    .default('debug'),
  API_KEY: z.string().optional().default(''),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive(),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_SSL: z.coerce.boolean().default(false),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TLS: z.coerce.boolean().default(false),
  EMBEDDING_PROVIDER: z.enum(['fake', 'openai-compatible']).default('fake'),
  LLM_PROVIDER: z.enum(['fake', 'openai-compatible']).default('fake'),
  OPENAI_COMPATIBLE_BASE_URL: z.string().optional().default(''),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional().default(''),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  LLM_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_COMPATIBLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  DATABASE_URL: z.string().min(1),
  SEARCH_BACKEND: z
    .enum(['postgres', 'qdrant-elasticsearch'])
    .default('postgres'),
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().default(''),
  QDRANT_COLLECTION: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .default('rag_chunks'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),
  ELASTICSEARCH_API_KEY: z.string().default(''),
  ELASTICSEARCH_INDEX: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]*$/)
    .default('rag-chunks'),
  OTEL_ENABLED: z.enum(['true', 'false']).default('false'),
  OTEL_SERVICE_NAME: z.string().min(1).default('rag-from-zero'),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z
    .string()
    .url()
    .default('http://localhost:4318/v1/traces'),
  CORS_ORIGIN: z.string().default('*'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
  UPLOAD_MAX_FILE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
  METRICS_API_KEY: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const env = envSchema.parse(config);

  if (
    (env.EMBEDDING_PROVIDER === 'openai-compatible' ||
      env.LLM_PROVIDER === 'openai-compatible') &&
    (!env.OPENAI_COMPATIBLE_BASE_URL || !env.OPENAI_COMPATIBLE_API_KEY)
  ) {
    throw new Error(
      'OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY are required when using openai-compatible providers',
    );
  }

  if (
    env.NODE_ENV === 'production' &&
    (env.EMBEDDING_PROVIDER === 'fake' || env.LLM_PROVIDER === 'fake')
  ) {
    throw new Error(
      'Production cannot run with fake embedding or LLM providers',
    );
  }

  if (env.NODE_ENV === 'production' && env.API_KEY.length < 32) {
    throw new Error('Production API_KEY must be at least 32 characters long');
  }

  if (env.NODE_ENV === 'production' && env.METRICS_API_KEY.length < 32) {
    throw new Error(
      'Production METRICS_API_KEY must be at least 32 characters long',
    );
  }

  return env;
}
