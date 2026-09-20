# Production Runbook

## Secrets

Use a cloud secret manager or deployment-platform secrets. Do not commit real
values to `.env`.

Required production secrets:

- `API_KEY`
- `METRICS_API_KEY`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD` when your Redis provider requires it
- `OPENAI_COMPATIBLE_API_KEY`

## Managed Postgres

Use a managed PostgreSQL instance with pgvector enabled, automated daily backups,
point-in-time recovery, and connection limits sized for API + worker instances.

Set:

- `DATABASE_URL`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_SSL=true` when your provider requires TLS

Run migrations before each deploy:

```bash
npm run db:migrate
```

## Managed Redis

Use managed Redis with persistence if queued jobs must survive provider
maintenance windows.

Set:

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_TLS=true` when your provider requires TLS

## Backups

Managed Postgres backups should be enabled at the provider level. The repo also
includes manual backup scripts:

```bash
DATABASE_URL="$DATABASE_URL" BACKUP_DIR=./backups scripts/backup-postgres.sh
DATABASE_URL="$DATABASE_URL" scripts/restore-postgres.sh ./backups/postgres-file.sql.gz
```

## Monitoring

Scrape:

- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/metrics` with `x-metrics-api-key`

Alert on:

- readiness failure
- 5xx rate
- p95 request duration
- queue job failures
- Postgres CPU/storage/connection saturation
- Redis memory/eviction/reconnects

## TLS and Domain

Use a load balancer or reverse proxy terminating TLS. A sample Nginx config is
available at `deploy/nginx/rag.conf`.

## Load Testing

Install k6 and run:

```bash
BASE_URL=https://your-domain.example API_KEY="$API_KEY" VUS=20 DURATION=2m k6 run load-tests/query.k6.js
```
