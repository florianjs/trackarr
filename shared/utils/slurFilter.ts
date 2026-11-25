/**
 * Slur filter: hateful words (racist, homophobic, transphobic, antisemitic…)
 * are masked in public text (shoutbox, forum, comments).
 *
 * Words are compared after normalization (case, accents, leetspeak such as
 * n1gg3r, stretched letters such as niiigger), word by word: a slur inside
 * another word (Niger, Scunthorpe) is left alone.
 */

/** Built-in list, matched against a normalized word */
const BUILT_IN: RegExp[] = [
  // English
  /^(sand|dune)?n+i+g{2,}(e+r+|a+h*|u+h+|a+z+|e+r+z+)s?$/,
  /^n+i+g+l+e+t+s?$/,
  /^f+a+g+(o+t+|e+t+)?s?$/,
  /^k+i+k+e+s?$/,
  /^c+h+i+n+k+s?$/,
  /^s+p+i+c+k*s?$/,
  /^g+o+o+k+s?$/,
  /^w+e+t+b+a+c+k+s?$/,
  /^(r+a+g+|t+o+w+e+l+)h+e+a+d+s?$/,
  /^t+r+a+n+n+(y|i+e+)s?$/,
  /^d+y+k+e+s?$/,
  // French
  /^n+e+g+r+e+(s+e+)?s?$/,
  /^b+o+u+g+n+o+u+l+e+s?$/,
  /^b+i+c+o+t+s?$/,
  /^y+o+u+p+i+n+e?s?$/,
  /^p+e+d+e+s?$/,
  /^t+a+r+l+o+u+z+e+s?$/,
  // German, Spanish, Italian
  /^n+e+g+e+r+n?$/,
  /^m+a+r+i+c+o+n+(e+s+)?$/,
  /^s+u+d+a+c+a+s?$/,
  /^f+r+o+c+i+o+$/,
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/** Words: letters, digits and leetspeak symbols (! only inside a word) */
const WORD = /[\p{L}\p{N}@$]+(?:!+[\p{L}\p{N}@$]+)*/gu;

export function normalizeWord(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
}

/**
 * Admin words, one per line. A trailing * matches every word starting
 * with it ("slur*" catches "slurs", "slurring")
 */
export function parseExtraWords(raw: string | null | undefined): RegExp[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2)
    .map((line) => {
      const prefix = line.endsWith('*');
      const word = normalizeWord(prefix ? line.slice(0, -1) : line).replace(/[^\p{L}\p{N}]/gu, '');
      return word ? new RegExp(`^${word}${prefix ? '' : 's?'}${prefix ? '' : '$'}`, 'u') : null;
    })
    .filter((re): re is RegExp => re !== null);
}

export function isSlur(word: string, extra: RegExp[] = []): boolean {
  const normalized = normalizeWord(word);
  return BUILT_IN.some((re) => re.test(normalized)) || extra.some((re) => re.test(normalized));
}

/** Mask every slur with asterisks, same length */
export function censorSlurs(text: string, extra: RegExp[] = []): { text: string; changed: boolean } {
  let changed = false;
  const result = text.replace(WORD, (word) => {
    if (!isSlur(word, extra)) return word;
    changed = true;
    return '*'.repeat([...word].length);
  });
  return { text: result, changed };
}
