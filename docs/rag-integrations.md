# RAG integrations

The stack uses one tool per alternative group:

| Technology | Runtime responsibility |
| --- | --- |
| LangChain (`@langchain/core`) | Named Runnable stages: embed question, hybrid retrieval, generate answer |
| LlamaIndex (`@llamaindex/core`) | Sentence-aware chunking with a 200-token target and 30-token overlap; actual token counts |
| Qdrant | Cosine vector retrieval using the stored chunk UUIDs |
| Elasticsearch | English-analyzed lexical retrieval using BM25 |
| RAGAS | Offline faithfulness, factual correctness, and context recall evaluation |
| OpenTelemetry | Query, embedding, vector/keyword retrieval, generation, ingestion, and indexing spans |

PostgreSQL stores documents, status, canonical chunks, and embeddings. Redis and
BullMQ still manage ingestion. The API response shape and reciprocal rank fusion
remain the same. LangChain and LlamaIndex run with either search backend.

## Local setup

Start Docker, install dependencies, and copy `.env.example` to `.env` for a new
checkout. For an existing checkout, add the new variables without overwriting
credentials. Set these in `.env` for **both API and worker**:

```dotenv
SEARCH_BACKEND=qdrant-elasticsearch
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=rag_chunks
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=rag-chunks
OTEL_ENABLED=true
OTEL_SERVICE_NAME=rag-from-zero
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
```

```bash
npm install
docker compose --profile rag up -d
npm run prisma:generate
npm run db:migrate
npm run build
npm run search:reindex
npm run start:dev
# Second terminal:
npm run start:worker:dev
```

Wait for Elasticsearch to respond on port 9200 before running reindex. Reindex
creates the indexes even when the database is empty. Readiness includes the
external indexes when this backend is selected. The local Compose profile binds
unauthenticated search services to loopback; it is a development setup.

`SEARCH_BACKEND=postgres` selects the original pgvector/PostgreSQL full-text
retrieval. Missing configuration defaults to this mode so existing installations
can migrate deliberately. `.env.example` opts new installations into the new stack.
`OTEL_ENABLED=false` disables export.

## Existing documents and failure handling

Pause ingestion and query traffic during the initial backfill or a full rebuild.
Run `npm run search:reindex` with the new backend configuration, then restart API
and worker using the same settings. Reindex copies existing stored embeddings;
it does not call the embedding provider, change chunk boundaries, or upgrade the
embedding model. Existing documents must be re-ingested to use LlamaIndex chunking.

The worker only marks a document completed after embedding and both external
index writes succeed. Indexing errors fail the job; BullMQ retries rebuild the
document entries. Partial Elasticsearch bulk failures are treated as errors.
Results from both engines are hydrated from PostgreSQL by chunk UUID and limited
to completed documents, preventing stale chunks and incomplete documents from
becoming answer context. Backend outages surface as errors rather than silently
changing retrieval behavior.

This is not a distributed transaction. Reindexing temporarily removes a document's
external entries. Deleted documents can leave orphaned external hits, which are
filtered out during hydration; enough stale hits can reduce recall despite 3x
candidate overfetch. Periodically rebuild into fresh collection/index names from
PostgreSQL, then switch API and worker together. Keep the same embedding model and
dimensions across ingestion and querying. Changing models requires re-embedding;
Qdrant dimension/distance mismatches fail explicitly. Do not reuse these indexes
for unrelated applications.

## Tracing

```bash
docker compose --profile rag logs -f otel-collector
```

The development collector prints received spans. For persistent trace storage,
configure its exporter for your observability backend. Instrumentation exports
operation names, timings, relationships within each query or ingestion job, and
error status; it does not attach document text, prompts, or answers. HTTP requests
and BullMQ producer/consumer context propagation are not auto-instrumented.
Nest shutdown hooks flush the SDK for API and worker.

## RAGAS evaluation

Use Python 3.11+ in an isolated environment:

```bash
python3 -m venv .venv
.venv/bin/pip install -r evaluation/requirements.txt
```

Run the API and worker with real embedding and generation providers for meaningful
scores. Upload `evaluation/fixture.txt` through `/api/documents/upload` and wait
until `/api/documents/:id` reports `completed`. Alternatively supply your own JSONL
questions with `question` and `reference` fields and corresponding documents.

```bash
# API_KEY must be exported in this shell; the Python runner does not load .env.
curl http://localhost:3000/api/documents/upload \
  -H "x-api-key: $API_KEY" -F 'file=@evaluation/fixture.txt'

# Collect API responses without invoking a judge or installing RAGAS:
python3 evaluation/evaluate.py --collect-only

# Set EVAL_API_KEY securely in your shell. These may target a separate judge model.
export EVAL_BASE_URL=https://api.openai.com/v1
export EVAL_MODEL=gpt-4.1-mini
.venv/bin/python evaluation/evaluate.py --min-score 0.7
```

The evaluator sends questions, generated answers, reference answers, and the actual
context supplied to generation to the configured judge provider. It writes samples,
aggregate scores, and a pass/fail result to ignored `evaluation/results.json`.
Model calls incur the provider's normal cost. Failures and nonfinite/below-threshold
scores produce a nonzero exit code. The two bundled questions are smoke fixtures,
not a representative quality benchmark. Use a held-out dataset before setting a
production quality threshold. RAGAS runs separately from the Node API and CI's
default unit tests do not make paid model calls.

## Production configuration

`docker-compose.prod.yml` passes search and tracing settings into API and worker.
It does not provision external search or telemetry servers. Supply reachable URLs,
`QDRANT_API_KEY`, `ELASTICSEARCH_API_KEY`, and optional
`OTEL_EXPORTER_OTLP_HEADERS` for your deployed services. Host `localhost` URLs from
the development `.env` do not reach other containers. Initialize/backfill indexes
before directing traffic to the new backend. Keep search data backed up or rebuild
it from PostgreSQL; retain PostgreSQL backups as the source of truth.

## References

- [LangChain Runnable reference](https://reference.langchain.com/javascript/classes/_langchain_core.runnables.Runnable.html)
- [LlamaIndex TypeScript source](https://github.com/run-llama/LlamaIndexTS)
- [Qdrant query API](https://qdrant.tech/documentation/search/)
- [Elasticsearch JavaScript client](https://www.elastic.co/docs/reference/elasticsearch/clients/javascript/api-reference)
- [RAGAS evaluation workflow](https://docs.ragas.io/en/stable/getstarted/rag_eval/)
- [OpenTelemetry JavaScript instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
