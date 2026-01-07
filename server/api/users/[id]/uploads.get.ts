import { db, schema } from '../../../db';
import { eq, desc, sql } from 'drizzle-orm';
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
  await requireUserSession(event);

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
  const torrents = await db.query.torrents.findMany({
    where: eq(schema.torrents.uploaderId, params.id),
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
    .where(eq(schema.torrents.uploaderId, params.id));

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
