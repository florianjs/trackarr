/**
 * External media database IDs (IMDb, TMDb, TheTVDB), issue #47.
 * Accept what users naturally paste (raw ID or the page URL) and normalize.
 * Shared between app and server.
 */

export interface MediaIds {
  imdbId: string | null;
  tmdbId: number | null;
  tvdbId: number | null;
}

const MAX_NUMERIC_ID = 2_147_483_647; // Postgres integer

/** "tt0133093", "0133093", "https://www.imdb.com/title/tt0133093/" -> "tt0133093" */
export function parseImdbId(input: string | null | undefined): string | null {
  const value = input?.trim();
  if (!value) return null;
  const match = value.match(/^(?:https?:\/\/(?:www\.|m\.)?imdb\.com\/title\/)?(?:tt)?(\d{7,9})\/?(?:[?#].*)?$/i);
  return match ? `tt${match[1]}` : null;
}

function parseNumericId(value: string, urlPattern: RegExp): number | null {
  const match = value.match(urlPattern) ?? value.match(/^(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_NUMERIC_ID ? id : null;
}

/** "603", "https://www.themoviedb.org/movie/603-the-matrix" -> 603 */
export function parseTmdbId(input: string | number | null | undefined): number | null {
  if (input == null || input === '') return null;
  return parseNumericId(
    String(input).trim(),
    /^https?:\/\/(?:www\.)?themoviedb\.org\/(?:movie|tv)\/(\d+)(?:[-/?#].*)?$/i
  );
}

/** "81189", "https://thetvdb.com/?tab=series&id=81189" -> 81189 */
export function parseTvdbId(input: string | number | null | undefined): number | null {
  if (input == null || input === '') return null;
  return parseNumericId(
    String(input).trim(),
    /^https?:\/\/(?:www\.)?thetvdb\.com\/.*[?&]id=(\d+)(?:[&#].*)?$/i
  );
}

export function imdbUrl(id: string): string {
  return `https://www.imdb.com/title/${id}/`;
}

/** TMDb IDs are per type; the "tv" path is used for TV categories */
export function tmdbUrl(id: number, kind: 'movie' | 'tv' = 'movie'): string {
  return `https://www.themoviedb.org/${kind}/${id}`;
}

export function tvdbUrl(id: number): string {
  return `https://thetvdb.com/dereferrer/series/${id}`;
}

export type MediaIdsInput = Partial<
  Record<keyof MediaIds, string | number | null | undefined>
>;

/**
 * Parse user-supplied IDs. Keys left undefined are not returned (unchanged);
 * empty values clear the ID. Values that do not parse are listed in `invalid`.
 */
export function parseMediaIds(raw: MediaIdsInput): {
  ids: Partial<MediaIds>;
  invalid: (keyof MediaIds)[];
} {
  const ids: Partial<MediaIds> = {};
  const invalid: (keyof MediaIds)[] = [];

  const parsers = {
    imdbId: (v: string | number) => parseImdbId(String(v)),
    tmdbId: parseTmdbId,
    tvdbId: parseTvdbId,
  } as const;

  for (const key of Object.keys(parsers) as (keyof MediaIds)[]) {
    const value = raw[key];
    if (value === undefined) continue;
    if (value === null || String(value).trim() === '') {
      ids[key] = null;
      continue;
    }
    const parsed = parsers[key](value);
    if (parsed === null) invalid.push(key);
    else (ids as Record<string, unknown>)[key] = parsed;
  }

  return { ids, invalid };
}
