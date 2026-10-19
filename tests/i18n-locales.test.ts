import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Every locale mirrors English: same files, same keys, same placeholders and
 * the same number of plural forms (Russian has one more, see i18n/plural.ts).
 */

const ROOT = join(__dirname, '..', 'i18n', 'locales');
const SOURCE = 'en';
const EXTRA_PLURAL_FORM = new Set(['ru']);

type Tree = { [key: string]: Tree | string };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const load = (locale: string, file: string) =>
  flatten(JSON.parse(readFileSync(join(ROOT, locale, file), 'utf8')) as Tree);

/** Named interpolations used, whatever their order or count */
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');
const pluralForms = (text: string) => text.split(' | ').length;

const files = readdirSync(join(ROOT, SOURCE)).filter((f) => f.endsWith('.json'));
const locales = readdirSync(ROOT).filter((l) => l !== SOURCE && existsSync(join(ROOT, l)));

describe.each(locales)('locale %s', (locale) => {
  it.each(files)('%s mirrors English', (file) => {
    expect(existsSync(join(ROOT, locale, file)), `${locale}/${file} is missing`).toBe(true);
    const source = load(SOURCE, file);
    const target = load(locale, file);

    expect([...target.keys()].filter((k) => !source.has(k)), 'keys not in English').toEqual([]);
    expect([...source.keys()].filter((k) => !target.has(k)), 'keys missing').toEqual([]);

    const problems: string[] = [];
    for (const [key, en] of source) {
      const text = target.get(key) ?? '';
      if (!text.trim()) problems.push(`${key}: empty`);
      if (placeholders(text) !== placeholders(en)) {
        problems.push(`${key}: placeholders {${placeholders(text)}} vs {${placeholders(en)}}`);
      }
      const expected = pluralForms(en) + (EXTRA_PLURAL_FORM.has(locale) && pluralForms(en) > 1 ? 1 : 0);
      if (pluralForms(text) !== expected) problems.push(`${key}: ${pluralForms(text)} plural forms, expected ${expected}`);
      // vue-i18n syntax: a stray @ starts a linked message, a stray | splits plurals
      if (/@/.test(text) && !/@/.test(en)) problems.push(`${key}: unescaped @`);
      if (text.replaceAll(' | ', '').includes('|')) problems.push(`${key}: stray |`);
    }
    expect(problems).toEqual([]);
  });
});
