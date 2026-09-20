#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/restore-postgres.sh <backup.sql.gz>" >&2
  exit 1
fi

gzip -dc "$1" | psql "$DATABASE_URL"
