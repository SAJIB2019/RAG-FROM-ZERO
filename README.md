# RAG From Zero

Production-shaped NestJS RAG backend with PostgreSQL, pgvector, Redis, BullMQ,
Prisma query reads, LangChain orchestration, LlamaIndex chunking, hybrid retrieval,
and OpenAI-compatible providers. Qdrant + Elasticsearch retrieval, OpenTelemetry
tracing, and a Python RAGAS evaluation runner are available.

See [RAG integrations](docs/rag-integrations.md) for setup, migration, and evaluation.

## Local Development

```bash
npm install
docker compose up -d
npm run prisma:generate
npm run db:migrate
npm run start:dev
```

Start the worker in a second terminal:

```bash
npm run start:worker:dev
```

Protected endpoints require `x-api-key` when `API_KEY` is set:

```bash
curl -X POST http://localhost:3000/api/query \
  -H 'content-type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{"question":"What is the refund policy?"}'
```

## Production Checklist

Before production, set real secrets and providers:

- `NODE_ENV=production`
- `API_KEY` with at least 32 random characters
- `CORS_ORIGIN` to your real frontend origin, not `*`
- `EMBEDDING_PROVIDER=openai-compatible`
- `LLM_PROVIDER=openai-compatible`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `EMBEDDING_DIMENSIONS` matching your embedding model

Run verification before deploy:

```bash
npm run check
```

Run database migrations before starting new app versions:

```bash
npm run db:migrate
```

Manual database backups:

```bash
npm run db:backup
npm run db:restore -- ./backups/postgres-file.sql.gz
```

## Docker Production Shape

```bash
docker compose -f docker-compose.prod.yml up --build
```

The production compose file runs separate `api` and `worker` services. For a real
cloud deployment, use managed Postgres, managed Redis, centralized logs, metrics,
alerts, backups, and a secret manager.

Provider-agnostic production assets:

- `deploy/nginx/rag.conf` for TLS reverse proxy setup.
- `deploy/prometheus/prometheus.yml` for metrics scraping.
- `scripts/backup-postgres.sh` and `scripts/restore-postgres.sh` for manual backups.
- `load-tests/query.k6.js` for load testing.
- `docs/production-runbook.md` for deployment operations.

## Health Checks

- `GET /api/health` is a public liveness endpoint.
- `GET /api/health/ready` is a public readiness endpoint that checks Postgres and Redis.
- `GET /api/metrics` exposes Prometheus metrics and accepts `x-metrics-api-key` or `Authorization: Bearer <METRICS_API_KEY>`.

## Load Testing

```bash
BASE_URL=http://localhost:3000 API_KEY="$API_KEY" VUS=20 DURATION=2m npm run load:test
```
