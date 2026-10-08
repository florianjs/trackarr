/**
 * Footer links configured by admins (icon + label + URL).
 * Shared between app (editor, rendering) and server (validation).
 */

export interface FooterLink {
  icon: string;
  label: string;
  url: string;
}

/** Icons offered in the admin editor (Phosphor set, bundled by @nuxt/icon) */
export const FOOTER_ICONS = [
  'ph:globe',
  'ph:github-logo',
  'ph:gitlab-logo',
  'ph:discord-logo',
  'ph:telegram-logo',
  'ph:x-logo',
  'ph:mastodon-logo',
  'ph:reddit-logo',
  'ph:youtube-logo',
  'ph:twitch-logo',
  'ph:matrix-logo',
  'ph:envelope',
  'ph:book-open',
  'ph:heart',
  'ph:rss',
  'ph:link',
] as const;

export const MAX_FOOTER_LINKS = 8;

export const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { icon: 'ph:globe', label: 'Website', url: 'https://florianargaud.com/' },
  { icon: 'ph:github-logo', label: 'GitHub', url: 'https://github.com/florianjs/trackarr' },
  { icon: 'ph:discord-logo', label: 'Discord', url: 'https://discord.gg/bbbkCPkdRk' },
];

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate links coming from the admin or the database. Returns null when
 * anything is invalid (unknown icon, non http(s)/mailto URL, too many links).
 */
export function parseFooterLinks(raw: unknown): FooterLink[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FOOTER_LINKS) return null;

  const links: FooterLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { icon, label, url } = item as Record<string, unknown>;
    if (typeof icon !== 'string' || !(FOOTER_ICONS as readonly string[]).includes(icon)) return null;
    if (typeof label !== 'string' || label.trim().length === 0 || label.length > 50) return null;
    if (typeof url !== 'string' || url.length > 500 || !isSafeUrl(url.trim())) return null;
    links.push({ icon, label: label.trim(), url: url.trim() });
  }
  return links;
}
