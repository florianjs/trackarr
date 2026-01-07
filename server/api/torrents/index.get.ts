import { db, schema } from '../../db';
import { getStats } from '../../redis/cache';
import { desc, eq, ilike, sql, and, or } from 'drizzle-orm';
import { validateQuery, torrentQuerySchema } from '../../utils/schemas';

export default defineEventHandler(async (event) => {
  // Require authentication
  const { user } = await requireUserSession(event);

  // Validate query parameters with Zod
  const query = validateQuery(event, torrentQuerySchema);

  const offset = (query.page - 1) * query.limit;

  // Check if user can see unapproved torrents
  const canSeeUnapproved = user.isAdmin || user.isModerator;

  // Build where clause
  const conditions = [];

  // Only show approved torrents to regular users (but show their own pending)
  if (!canSeeUnapproved) {
    conditions.push(
      or(
        eq(schema.torrents.isApproved, true),
        eq(schema.torrents.uploaderId, user.id)
      )
    );
  }

  if (query.search) {
    // Intelligent search: if it looks like an infoHash, search by it too
    const isHash = /^[0-9a-fA-F]{40}$/.test(query.search);
    if (isHash) {
      conditions.push(eq(schema.torrents.infoHash, query.search.toLowerCase()));
    } else {
      // Split search into terms for more flexible matching
      const terms = query.search.split(/\s+/).filter((t) => t.length > 0);
      if (terms.length > 0) {
        conditions.push(
          and(...terms.map((term) => ilike(schema.torrents.name, `%${term}%`)))
        );
      }
    }
  }
  if (query.categoryId) {
    conditions.push(eq(schema.torrents.categoryId, query.categoryId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get torrents with optional search
  const torrents = await db.query.torrents.findMany({
    where: whereClause,
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
    .where(whereClause);

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
