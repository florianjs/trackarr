import { db, schema } from '../../../db';
import { and, eq, desc, sql } from 'drizzle-orm';
import { getStats } from '../../../redis/cache';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

export default defineEventHandler(async (event) => {
  const { user: viewer } = await requireAuthSession(event);

  const params = paramsSchema.parse(getRouterParams(event));
  const query = querySchema.parse(getQuery(event));

  const offset = (query.page - 1) * query.limit;

  // Verify user exists
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, params.id),
    columns: { id: true },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  // Get user's uploads
  // Pending torrents stay visible only to their uploader and staff
  const canSeePending =
    viewer.id === params.id || viewer.isAdmin || viewer.isModerator;
  const where = canSeePending
    ? eq(schema.torrents.uploaderId, params.id)
    : and(
        eq(schema.torrents.uploaderId, params.id),
        eq(schema.torrents.isApproved, true)
      );

  const torrents = await db.query.torrents.findMany({
    where,
    // Raw .torrent blob embeds the uploader's announce URL (passkey)
    columns: { torrentData: false },
    with: {
      category: true,
    },
    orderBy: [desc(schema.torrents.createdAt)],
    limit: query.limit,
    offset,
  });

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.torrents)
    .where(where);

  const total = countResult[0]?.count || 0;

  // Enrich with live stats from Redis
  const enriched = await Promise.all(
    torrents.map(async (torrent) => {
      const stats = await getStats(torrent.infoHash);
      return {
        ...torrent,
        stats: {
          seeders: stats.seeders,
          leechers: stats.leechers,
          completed: stats.completed,
        },
      };
    })
  );

  return {
    data: enriched,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
});
