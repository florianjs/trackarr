/**
 * Best-effort reading of a scene/P2P release name
 * ("Movie.Title.2021.1080p.BluRay.x264-GROUP"): enough to prefill the title
 * and spot what MediaInfo cannot tell (source, group). Never authoritative:
 * every value stays editable.
 */

export interface ReleaseName {
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  resolution: string | null;
  source: string | null;
  group: string | null;
}

const VIDEO_EXT = /\.(mkv|mp4|m4v|avi|mov|wmv|ts|m2ts|webm|mpg|mpeg)$/i;

const SOURCES: [RegExp, string][] = [
  [/\bremux\b/i, 'Remux'],
  [/\bblu-?ray\b|\bbd-?rip\b|\bbrrip\b/i, 'BluRay'],
  [/\bweb-?dl\b/i, 'WEB-DL'],
  [/\bweb-?rip\b/i, 'WEBRip'],
  [/\bweb\b/i, 'WEB'],
  [/\bhdtv\b/i, 'HDTV'],
  [/\bdvd-?rip\b/i, 'DVDRip'],
  [/\bdvd\b/i, 'DVD'],
];

export function stripVideoExtension(name: string): string {
  return name.replace(VIDEO_EXT, '');
}

export function parseReleaseName(input: string): ReleaseName {
  const name = stripVideoExtension(input.split('/').pop() ?? input).trim();
  const spaced = name.replace(/[._]+/g, ' ');

  const groupMatch = name.match(/-([A-Za-z0-9]+)(?:\[[^\]]*\])?$/);
  const group = groupMatch && !/^\d+p$/i.test(groupMatch[1]!) ? groupMatch[1]! : null;

  const se = spaced.match(/\bS(\d{1,2})(?:E(\d{1,3}))?\b/i);
  const year = spaced.match(/\b(19[2-9]\d|20\d\d)\b/);
  const resolution = spaced.match(/\b(2160|1440|1080|720|576|480)[pi]\b/i);
  const source = SOURCES.find(([re]) => re.test(spaced))?.[1] ?? null;

  // The title ends where the first technical token starts
  const markers = [se?.index, year?.index, resolution?.index].filter(
    (i): i is number => typeof i === 'number' && i > 0
  );
  const cut = markers.length ? Math.min(...markers) : spaced.length;
  const title = spaced.slice(0, cut).replace(/[\s\-()[\]]+$/, '').trim() || spaced.trim();

  return {
    title,
    year: year ? Number(year[1]) : null,
    season: se ? Number(se[1]) : null,
    episode: se?.[2] ? Number(se[2]) : null,
    resolution: resolution ? `${resolution[1]}p` : null,
    source,
    group,
  };
}
