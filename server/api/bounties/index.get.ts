import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { requireBonusEnabled } from '../../utils/bonus';
import { escapeLike } from '../../utils/validation';

const querySchema = z.object({
  status: z.enum(['open', 'claimed', 'filled', 'cancelled', 'all']).default('open'),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/**
 * GET /api/bounties
 * Torrent requests with a points reward
 */
export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  await requireBonusEnabled();
  const query = querySchema.parse(getQuery(event));

  const conditions = [];
  if (query.status !== 'all') conditions.push(eq(schema.bounties.status, query.status));
  if (query.q) conditions.push(ilike(schema.bounties.title, `%${escapeLike(query.q)}%`));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [total]] = await Promise.all([
    db.query.bounties.findMany({
      where,
      columns: {
        id: true,
        title: true,
        status: true,
        totalPoints: true,
        imdbId: true,
        createdAt: true,
      },
      with: {
        requester: { columns: { id: true, username: true } },
        category: { columns: { id: true, name: true } },
      },
      orderBy: [desc(schema.bounties.createdAt)],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    }),
    db.select({ value: count() }).from(schema.bounties).where(where),
  ]);

  return {
    bounties: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: total?.value ?? 0,
    },
  };
});
