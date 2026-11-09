/**
 * BBCode description of a release, in the chosen language: title, release
 * details, video/audio/subtitle tracks, screenshots (thumbnail linking to the
 * full image), file list and the full MediaInfo report in spoilers.
 * Rendered by the site (shared/utils/bbcode.ts) and reusable elsewhere.
 */

import { DESCRIPTION_LABELS, type DescriptionLanguage } from './labels';
import { resolutionLabel, type MediaSummary } from './mediainfo';
import type { ReleaseName } from './releaseName';

export interface Screenshot {
  /** Full-size image page (pixhost show page) */
  page: string;
  /** Thumbnail URL */
  thumb: string;
}

export interface DescriptionInput {
  lang: DescriptionLanguage;
  title: string;
  release?: Partial<ReleaseName>;
  summary?: MediaSummary | null;
  mediaInfoText?: string | null;
  screenshots?: Screenshot[];
  files?: { path: string; size: number }[];
  notes?: string | null;
}

/** BBCode closes on "[/": keep user text from opening or closing tags */
export function escapeBbcode(text: string): string {
  return text.replace(/\[/g, '(').replace(/\]/g, ')');
}

export function formatSize(bytes: number, lang: DescriptionLanguage): string {
  const units = DESCRIPTION_LABELS[lang].units;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

export function formatDuration(seconds: number, lang: DescriptionLanguage): string {
  const { hours, minutes } = DESCRIPTION_LABELS[lang];
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${Math.max(m, seconds > 0 ? 1 : 0)} ${minutes}`;
  return `${h} ${hours} ${String(m).padStart(2, '0')} ${minutes}`;
}

export function formatBitrate(bps: number, lang: DescriptionLanguage): string {
  const nf = (n: number, d: number) =>
    new Intl.NumberFormat(lang, { maximumFractionDigits: d }).format(n);
  return bps >= 1_000_000 ? `${nf(bps / 1_000_000, 1)} Mb/s` : `${nf(bps / 1000, 0)} kb/s`;
}

/** "fr" -> "Français" in the description language; unknown codes as given */
export function languageName(code: string | null, lang: DescriptionLanguage): string | null {
  if (!code) return null;
  try {
    const name = new Intl.DisplayNames([lang], { type: 'language' }).of(code);
    if (name && name !== code) return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
  } catch {
    // Not a language tag: MediaInfo sometimes gives a full name
  }
  return code;
}

const join = (parts: (string | null | undefined | false)[]) =>
  parts.filter((p): p is string => Boolean(p)).join(' · ');

export function buildDescription(input: DescriptionInput): string {
  const { lang } = input;
  const l = DESCRIPTION_LABELS[lang];
  const nf = (n: number, d = 3) => new Intl.NumberFormat(lang, { maximumFractionDigits: d }).format(n);
  const out: string[] = [];
  const release = input.release ?? {};
  const summary = input.summary;

  // Title
  const heading = `${escapeBbcode(input.title)}${release.year ? ` (${release.year})` : ''}`;
  const episode =
    release.season !== null && release.season !== undefined
      ? join([`${l.season} ${release.season}`, release.episode ? `${l.episode} ${release.episode}` : null])
      : null;
  out.push(`[center][size=6][b]${heading}[/b][/size]${episode ? `\n[size=4]${episode}[/size]` : ''}[/center]`);

  if (input.notes?.trim()) {
    out.push(`[b]${l.notes}[/b]\n${escapeBbcode(input.notes.trim())}`);
  }

  // Release
  const video = summary?.video[0];
  const releaseItems = [
    release.source ? `[b]${l.source}:[/b] ${escapeBbcode(release.source)}` : null,
    release.resolution || resolutionLabel(video)
      ? `[b]${l.video}:[/b] ${release.resolution ?? resolutionLabel(video)}`
      : null,
    release.group ? `[b]${l.group}:[/b] ${escapeBbcode(release.group)}` : null,
  ].filter(Boolean);
  if (releaseItems.length) {
    out.push(`[b][size=4]${l.release}[/size][/b]\n${releaseItems.join('\n')}`);
  }

  if (summary) {
    // General
    out.push(
      `[b][size=4]${l.general}[/size][/b]\n` +
        [
          summary.container ? `[b]${l.container}:[/b] ${escapeBbcode(summary.container)}` : null,
          summary.duration ? `[b]${l.duration}:[/b] ${formatDuration(summary.duration, lang)}` : null,
          summary.size ? `[b]${l.size}:[/b] ${formatSize(summary.size, lang)}` : null,
          summary.bitrate ? `[b]${l.bitrate}:[/b] ${formatBitrate(summary.bitrate, lang)}` : null,
        ]
          .filter(Boolean)
          .join('\n')
    );

    const list = (title: string, items: string[]) =>
      items.length ? `[b][size=4]${title}[/size][/b]\n[list]\n${items.map((i) => `[*]${i}`).join('\n')}\n[/list]` : null;

    const videoBlock = list(
      l.video,
      summary.video.map((v) =>
        join([
          escapeBbcode(v.codec),
          v.width && v.height ? `${v.width}×${v.height}${resolutionLabel(v) ? ` (${resolutionLabel(v)})` : ''}` : null,
          v.fps ? `${nf(v.fps)} fps` : null,
          v.bitrate ? formatBitrate(v.bitrate, lang) : null,
          v.bitDepth ? `${v.bitDepth} ${l.bits}` : null,
          v.hdr,
        ])
      )
    );
    const audioBlock = list(
      l.audio,
      summary.audio.map((a) =>
        join([
          languageName(a.language, lang),
          escapeBbcode(a.codec),
          a.channels,
          a.bitrate ? formatBitrate(a.bitrate, lang) : null,
          a.title ? `"${escapeBbcode(a.title)}"` : null,
        ])
      )
    );
    const subtitleBlock = list(
      l.subtitles,
      summary.subtitles.map((s) =>
        join([
          `${languageName(s.language, lang) ?? '?'}${s.forced ? ` (${l.forced})` : ''}`,
          escapeBbcode(s.format),
          s.title ? `"${escapeBbcode(s.title)}"` : null,
        ])
      )
    );
    for (const block of [videoBlock, audioBlock, subtitleBlock]) if (block) out.push(block);
  }

  // Screenshots: two per line, thumbnail linking to the full image
  const shots = (input.screenshots ?? []).filter((s) => /^https:\/\//.test(s.page) && /^https:\/\//.test(s.thumb));
  if (shots.length) {
    const rows: string[] = [];
    for (let i = 0; i < shots.length; i += 2) {
      rows.push(shots.slice(i, i + 2).map((s) => `[url=${s.page}][img]${s.thumb}[/img][/url]`).join(' '));
    }
    out.push(`[b][size=4]${l.screenshots}[/size][/b]\n[center]${rows.join('\n')}[/center]`);
  }

  const files = input.files ?? [];
  if (files.length > 1) {
    out.push(
      `[spoiler=${l.files} (${files.length})][list]\n` +
        files.map((f) => `[*]${escapeBbcode(f.path)} (${formatSize(f.size, lang)})`).join('\n') +
        '\n[/list][/spoiler]'
    );
  }

  if (input.mediaInfoText?.trim()) {
    // Inside [code] nothing is parsed: only a literal closing tag must go
    out.push(`[spoiler=MediaInfo][code]${input.mediaInfoText.trim().replace(/\[\/code\]/gi, '[/c0de]')}[/code][/spoiler]`);
  }

  return out.join('\n\n');
}
