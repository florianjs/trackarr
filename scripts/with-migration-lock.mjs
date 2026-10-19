#!/usr/bin/env node
// Run a command while holding a Postgres advisory lock, so app nodes started
// together apply schema migrations one at a time (drizzle-kit push is not
// safe to run concurrently). Transaction-level lock: it also holds through
// PgBouncer in transaction pooling mode.
// Usage: node scripts/with-migration-lock.mjs <command> [args...]

import { spawn } from 'node:child_process';
import postgres from 'postgres';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: with-migration-lock.mjs <command> [args...]');
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

let exitCode = 1;
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('trackarr:migrations'))`;
    exitCode = await new Promise((resolve) => {
      spawn(command, args, { stdio: 'inherit' }).on('exit', (code) => resolve(code ?? 1));
    });
  });
} finally {
  await sql.end();
}
process.exit(exitCode);
