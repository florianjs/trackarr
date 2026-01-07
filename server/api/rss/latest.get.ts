import { db, schema } from '../../db';
import { getStats } from '../../redis/cache';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * GET /api/rss/latest
 * RSS feed for latest torrents
 */
export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event));

  const torrents = await db.query.torrents.findMany({
    where: eq(schema.torrents.isActive, true),
    with: {
      category: true,
      uploader: {
        columns: { username: true },
      },
    },
    orderBy: [desc(schema.torrents.createdAt)],
    limit: query.limit,
  });

  // Get stats from Redis
  const enriched = await Promise.all(
    torrents.map(async (t) => ({
      ...t,
      stats: await getStats(t.infoHash),
    }))
  );

  // Build RSS XML
  const baseUrl = getRequestURL(event).origin;
  const rss = buildRSSFeed({
    title: 'OpenTracker - Latest Torrents',
    link: `${baseUrl}/torrents`,
    description: 'Latest torrent uploads on OpenTracker',
    items: enriched.map((t) => ({
      title: t.name,
      link: `${baseUrl}/torrents/${t.infoHash}`,
      description: buildItemDescription(t),
      category: t.category?.name,
      pubDate: new Date(t.createdAt).toUTCString(),
      guid: t.infoHash,
    })),
  });

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=300'); // 5min cache
  return rss;
});

interface RSSItem {
  title: string;
  link: string;
  description: string;
  category?: string;
  pubDate: string;
  guid: string;
}

interface RSSFeed {
  title: string;
  link: string;
  description: string;
  items: RSSItem[];
}

function buildRSSFeed(feed: RSSFeed): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const items = feed.items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description><![CDATA[${item.description}]]></description>
      ${item.category ? `<category>${escapeXml(item.category)}</category>` : ''}
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
    </item>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feed.link)}/api/rss/latest" rel="self" type="application/rss+xml"/>${items}
  </channel>
</rss>`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function buildItemDescription(torrent: any): string {
  const parts = [
    `Size: ${formatBytes(torrent.size)}`,
    `Seeders: ${torrent.stats.seeders}`,
    `Leechers: ${torrent.stats.leechers}`,
    `Completed: ${torrent.stats.completed}`,
  ];

  if (torrent.uploader?.username) {
    parts.push(`Uploader: ${torrent.uploader.username}`);
  }

  if (torrent.description) {
    parts.push('', torrent.description.slice(0, 500));
  }

  return parts.join('\n');
}
