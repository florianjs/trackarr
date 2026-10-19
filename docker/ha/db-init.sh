#!/bin/sh
# Create the application role and database on the Patroni primary.
# Idempotent: runs on every node start, does nothing once they exist.
# template0: Spilo installs monitoring extensions in template1, and drizzle-kit
# push would try to drop their objects from the app database.

set -e

URL="postgres://postgres:${PG_SUPERUSER_PASSWORD}@${PG_HOSTS}/postgres?target_session_attrs=read-write&connect_timeout=5"

echo "[db-init] Waiting for the Postgres primary..."
until psql "$URL" -qAtc 'SELECT 1' >/dev/null 2>&1; do
  sleep 2
done

psql "$URL" -v ON_ERROR_STOP=1 -v user="$DB_USER" -v pw="$DB_PASSWORD" -v db="$DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'user', :'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'user')\gexec
SELECT format('CREATE DATABASE %I OWNER %I TEMPLATE template0', :'db', :'user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db')\gexec
SQL

# Extensions need a superuser (same as docker/postgres/init.sql)
psql "$(echo "$URL" | sed "s#/postgres?#/${DB_NAME}?#")" -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'

echo "[db-init] Role and database ready"
