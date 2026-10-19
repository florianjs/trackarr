#!/bin/sh
# Entrypoint script for Trackarr Docker container
# Runs database migrations before starting the application

set -e

echo "🚀 Starting Trackarr..."

# Run database schema push (migrations), one node at a time when replicated
echo "📦 Running database migrations..."
node ./scripts/with-migration-lock.mjs ./scripts/db-push.sh

# Seed default categories if needed
if [ -f ./scripts/seed-categories.ts ]; then
  echo "🌱 Checking category seeds..."
  npx tsx ./scripts/seed-categories.ts 2>/dev/null || echo "⚠️ Category seeding skipped or already complete"
fi

echo ""
echo "✅ Database ready, starting application..."
echo ""

# Start the application
exec node .output/server/index.mjs
