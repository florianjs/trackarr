import { flattenMessages, type MessageTree } from '../../shared/utils/appearance';

/**
 * Translations as shipped in i18n/locales/<locale>/*.json (bundled as server
 * assets, see nuxt.config.ts), flattened: what the admin text editor shows
 * as defaults and the keys it accepts.
 */
const cache = new Map<string, Record<string, string>>();

export async function getLocaleSource(locale: string): Promise<Record<string, string>> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const storage = useStorage('assets:locales');
  const out: Record<string, string> = {};
  for (const key of await storage.getKeys(locale)) {
    if (!key.endsWith('.json')) continue;
    const tree = await storage.getItem<MessageTree>(key);
    if (tree && typeof tree === 'object') flattenMessages(tree, '', out);
  }
  cache.set(locale, out);
  return out;
}
