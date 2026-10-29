#!/bin/sh
# Database schema push script
# Automatically adapts DATABASE_URL for local execution

set -e

# Hide credentials when printing connection URLs
mask_url() {
  echo "$1" | sed -E 's#://[^@/]+@#://***@#'
}

# Get DATABASE_URL from environment or .env file
if [ -z "$DATABASE_URL" ]; then
  if [ -f .env ]; then
    export $(grep -E '^DATABASE_URL=' .env | xargs)
  fi
fi

# Default URL if not set
DATABASE_URL="${DATABASE_URL:-postgres://tracker:tracker@postgres:5432/trackarr}"

# Only replace docker hostnames with localhost if NOT running in Docker
# Check if we're in Docker by looking for /.dockerenv or running hostname check
if [ ! -f /.dockerenv ] && [ "$(hostname)" != "trackarr-app" ]; then
  LOCAL_URL=$(echo "$DATABASE_URL" | sed -E 's/@(postgres|pgbouncer|db|trackarr-db):/@localhost:/g')
  echo "🔄 Pushing schema to database (local mode)..."
  echo "   Original: $(mask_url "$DATABASE_URL")"
  echo "   Local:    $(mask_url "$LOCAL_URL")"
  DATABASE_URL="$LOCAL_URL"
else
  echo "🔄 Pushing schema to database (Docker mode)..."
  echo "   URL: $(mask_url "$DATABASE_URL")"
fi
echo ""

echo "📜 Applying guarded SQL migrations..."
DATABASE_URL="$DATABASE_URL" node ./scripts/apply-sql-migrations.mjs
echo ""

if [ -t 0 ] && [ -t 1 ]; then
  # Interactive: drizzle-kit can ask its questions
  DATABASE_URL="$DATABASE_URL" npx drizzle-kit push "$@"
else
  # drizzle-kit exits 0 when it needs a prompt it cannot show: catch the
  # error in its output, or the app would start against a stale schema
  PUSH_LOG=$(mktemp)
  DATABASE_URL="$DATABASE_URL" npx drizzle-kit push "$@" 2>&1 | tee "$PUSH_LOG"
  if grep -q -E '^(Error|error):' "$PUSH_LOG"; then
    rm -f "$PUSH_LOG"
    echo ""
    echo "❌ Schema push failed: see the error above"
    exit 1
  fi
  rm -f "$PUSH_LOG"
fi

echo ""
echo "✅ Schema pushed successfully"
