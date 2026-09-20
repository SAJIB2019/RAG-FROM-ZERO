#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="${BACKUP_DIR}/postgres-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$OUTPUT_FILE"

find "$BACKUP_DIR" -type f -name 'postgres-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Created backup: $OUTPUT_FILE"
