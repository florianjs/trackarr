import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  guardedMigrations,
  MIGRATIONS_DIR,
} from '../scripts/apply-sql-migrations.mjs';

describe('guardedMigrations', () => {
  it('keeps numbered .sql files from 0013 on, in order', () => {
    expect(
      guardedMigrations([
        '0019_b.sql',
        '0012_old.sql',
        'meta',
        '0013_a.sql',
        'notes.md',
      ])
    ).toEqual(['0013_a.sql', '0019_b.sql']);
  });
});

// They run on every start: a statement that fails the second time would
// stop the app from booting
describe('guarded migration files', () => {
  const files = guardedMigrations(readdirSync(MIGRATIONS_DIR));

  it.each(files)('%s can run twice', (file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const m of sql.matchAll(/CREATE (UNIQUE )?(TABLE|INDEX)\b(?! IF NOT EXISTS)/g)) {
      throw new Error(`${file}: unguarded "${m[0]}"`);
    }
    for (const m of sql.matchAll(/ADD COLUMN\b(?! IF NOT EXISTS)/g)) {
      throw new Error(`${file}: unguarded "${m[0]}"`);
    }
    if (/ADD CONSTRAINT/.test(sql)) {
      expect(sql).toMatch(/EXCEPTION WHEN duplicate_object/);
    }
  });
});
