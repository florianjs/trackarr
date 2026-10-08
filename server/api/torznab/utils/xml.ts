/**
 * Torznab XML Response Builders
 * Utilities for building XML responses conforming to Torznab specification
 */

import { cdata } from '../../../utils/validation';

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ============================================================================
// Torznab Error Response
// ============================================================================
export interface TorznabError {
  code: number;
  description: string;
}

export function buildErrorXml(error: TorznabError): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<error code="${error.code}" description="${escapeXml(error.description)}"/>`;
}

// Error codes per Torznab spec
export const TORZNAB_ERRORS = {
  INCORRECT_CREDENTIALS: {
    code: 100,
    description: 'Incorrect user credentials',
  },
  ACCOUNT_SUSPENDED: { code: 101, description: 'Account suspended' },
  INSUFFICIENT_PRIVILEGES: {
    code: 102,
    description: 'Insufficient privileges',
  },
  MISSING_PARAMETER: { code: 200, description: 'Missing parameter' },
  INCORRECT_PARAMETER: { code: 201, description: 'Incorrect parameter' },
  NO_SUCH_FUNCTION: { code: 300, description: 'No such function' },
  INTERNAL_ERROR: { code: 500, description: 'Internal error' },
  API_DISABLED: { code: 910, description: 'API disabled' },
} as const;

// ============================================================================
// Capabilities Response
// ============================================================================
export interface TorznabCategory {
  id: number;
  name: string;
  subcats?: TorznabCategory[];
}

export interface CapsConfig {
  serverVersion: string;
  serverTitle: string;
  maxLimit: number;
  defaultLimit: number;
  categories: TorznabCategory[];
}

export function buildCapsXml(config: CapsConfig): string {
  const buildSubcats = (subcats: TorznabCategory[] = []): string =>
    subcats
      .map((s) => `      <subcat id="${s.id}" name="${escapeXml(s.name)}"/>`)
      .join('\n');

  const buildCategories = (cats: TorznabCategory[]): string =>
    cats
      .map((c) => {
        const subcatsXml = c.subcats?.length
          ? `\n${buildSubcats(c.subcats)}\n    `
          : '';
        return `    <category id="${c.id}" name="${escapeXml(c.name)}">${subcatsXml}</category>`;
      })
      .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<caps>
  <server version="${escapeXml(config.serverVersion)}" title="${escapeXml(config.serverTitle)}"/>
  <limits max="${config.maxLimit}" default="${config.defaultLimit}"/>
  <registration available="no" open="no"/>

  <searching>
    <search available="yes" supportedParams="q"/>
    <tv-search available="yes" supportedParams="q,season,ep"/>
    <movie-search available="yes" supportedParams="q,imdbid"/>
    <audio-search available="no"/>
    <book-search available="no"/>
  </searching>

  <categories>
${buildCategories(config.categories)}
  </categories>
</caps>`;
}

// ============================================================================
// Search Response (RSS with Torznab extensions)
// ============================================================================
export interface TorznabItem {
  title: string;
  guid: string;
  link: string;
  commentsUrl: string;
  pubDate: Date;
  size: number;
  description?: string;
  categoryName?: string;
  categoryId: number;
  seeders: number;
  leechers: number;
  grabs: number;
  downloadUrl: string;
  downloadVolumeFactor?: number; // 0 = freeleech, 1 = normal
  uploadVolumeFactor?: number; // 1 = normal, 2 = double upload
  imdbId?: string;
}

export interface TorznabFeed {
  title: string;
  description: string;
  link: string;
  selfUrl: string;
  items: TorznabItem[];
}

export function buildSearchXml(feed: TorznabFeed): string {
  const items = feed.items
    .map((item) => {
      const attrs = [
        `      <torznab:attr name="category" value="${item.categoryId}"/>`,
        `      <torznab:attr name="size" value="${item.size}"/>`,
        `      <torznab:attr name="seeders" value="${item.seeders}"/>`,
        `      <torznab:attr name="peers" value="${item.leechers}"/>`,
        `      <torznab:attr name="grabs" value="${item.grabs}"/>`,
        `      <torznab:attr name="downloadvolumefactor" value="${item.downloadVolumeFactor ?? 1}"/>`,
        `      <torznab:attr name="uploadvolumefactor" value="${item.uploadVolumeFactor ?? 1}"/>`,
      ];

      if (item.imdbId) {
        attrs.push(
          `      <torznab:attr name="imdbid" value="${escapeXml(item.imdbId)}"/>`
        );
      }

      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <guid>${escapeXml(item.guid)}</guid>
      <link>${escapeXml(item.link)}</link>
      <comments>${escapeXml(item.commentsUrl)}</comments>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <size>${item.size}</size>
      <description>${cdata(item.description ?? '')}</description>
      ${item.categoryName ? `<category>${escapeXml(item.categoryName)}</category>` : ''}
${attrs.join('\n')}
      <enclosure url="${escapeXml(item.downloadUrl)}" length="${item.size}" type="application/x-bittorrent"/>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <description>${escapeXml(feed.description)}</description>
    <link>${escapeXml(feed.link)}</link>
    <language>en-us</language>
    <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}
