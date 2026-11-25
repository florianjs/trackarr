import { censorSlurs, parseExtraWords } from '../../shared/utils/slurFilter';
import { getSlurFilterWords, isSlurFilterEnabled } from './settings';

let extraCache: { raw: string; words: RegExp[] } = { raw: '', words: [] };

/**
 * Mask hateful words in text users post publicly, unless an admin turned the
 * filter off. Settings are cached (1 min), the admin list is compiled once
 */
export async function filterPublicText(text: string): Promise<string> {
  if (!text || !(await isSlurFilterEnabled())) return text;
  const raw = await getSlurFilterWords();
  if (raw !== extraCache.raw) extraCache = { raw, words: parseExtraWords(raw) };
  return censorSlurs(text, extraCache.words).text;
}
