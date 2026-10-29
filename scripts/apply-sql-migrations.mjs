#!/usr/bin/env node
// Apply the guarded SQL migrations before drizzle-kit push. Without a TTY,
// push cannot answer its prompts (e.g. a unique constraint on a non-empty
// table) and leaves the schema behind: once these files ran, the schema
// already matches and push has nothing left to ask.
// Files from FIRST_GUARDED on are idempotent (IF NOT EXISTS, duplicate_object
// handlers) and safe to rerun on every start; earlier ones are not, and push
// already brought every database past them.
// Usage: node scripts/apply-sql-migrations.mjs

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

export const MIGRATIONS_DIR = 'server/db/migrations';
export const FIRST_GUARDED = 13;

/** Guarded migration files, in the order they must run */
export function guardedMigrations(names) {
  return names
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => Number(name.slice(0, 4)) >= FIRST_GUARDED)
    .sort();
}

async function main() {
  const files = guardedMigrations(await readdir(MIGRATIONS_DIR));
  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    // Fresh database: these files alter tables push has not created yet.
    // Push builds the whole schema from scratch, and on empty tables it has
    // nothing to ask
    const [{ ready }] = await sql`SELECT to_regclass('public.users') IS NOT NULL AS ready`;
    if (!ready) {
      console.log('   (fresh database: push creates the schema)');
      return;
    }
    for (const file of files) {
      // No parameters: simple query protocol, several statements per file
      await sql.unsafe(await readFile(join(MIGRATIONS_DIR, file), 'utf8'));
      console.log(`   ✓ ${file}`);
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
