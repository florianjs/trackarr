#!/bin/sh
# Database schema push script
# Automatically adapts DATABASE_URL for local execution

set -e

# Get DATABASE_URL from environment or .env file
if [ -z "$DATABASE_URL" ]; then
  if [ -f .env ]; then
    export $(grep -E '^DATABASE_URL=' .env | xargs)
  fi
fi

# Default URL if not set
DATABASE_URL="${DATABASE_URL:-postgres://tracker:tracker@postgres:5432/opentracker}"

# Only replace docker hostnames with localhost if NOT running in Docker
# Check if we're in Docker by looking for /.dockerenv or running hostname check
if [ ! -f /.dockerenv ] && [ "$(hostname)" != "opentracker-app" ]; then
  LOCAL_URL=$(echo "$DATABASE_URL" | sed -E 's/@(postgres|pgbouncer|db|opentracker-db):/@localhost:/g')
  echo "🔄 Pushing schema to database (local mode)..."
  echo "   Original: $DATABASE_URL"
  echo "   Local:    $LOCAL_URL"
  DATABASE_URL="$LOCAL_URL"
else
  echo "🔄 Pushing schema to database (Docker mode)..."
  echo "   URL: $DATABASE_URL"
fi
echo ""

DATABASE_URL="$DATABASE_URL" npx drizzle-kit push "$@"

echo ""
echo "✅ Schema pushed successfully"
