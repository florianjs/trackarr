import { db, schema } from '../../../db';
import { getStats } from '../../../redis/cache';
import { desc, eq, and } from 'drizzle-orm';
import { z } from 'zod';

const paramsSchema = z.object({
  slug: z.string().min(1),
});

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * GET /api/rss/category/[slug]
 * RSS feed for a specific category
 */
export default defineEventHandler(async (event) => {
  const params = paramsSchema.parse(getRouterParams(event));
  const query = querySchema.parse(getQuery(event));

  // Find category
  const category = await db.query.categories.findFirst({
    where: eq(schema.categories.slug, params.slug),
  });

  if (!category) {
    throw createError({
      statusCode: 404,
      message: 'Category not found',
    });
  }

  const torrents = await db.query.torrents.findMany({
    where: and(
      eq(schema.torrents.isActive, true),
      eq(schema.torrents.categoryId, category.id)
    ),
    with: {
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
    title: `OpenTracker - ${category.name}`,
    link: `${baseUrl}/torrents?categoryId=${category.id}`,
    description: `Latest ${category.name} torrents on OpenTracker`,
    feedUrl: `${baseUrl}/api/rss/category/${params.slug}`,
    items: enriched.map((t) => ({
      title: t.name,
      link: `${baseUrl}/torrents/${t.infoHash}`,
      description: buildItemDescription(t),
      category: category.name,
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
  feedUrl: string;
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
    <atom:link href="${escapeXml(feed.feedUrl)}" rel="self" type="application/rss+xml"/>${items}
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
