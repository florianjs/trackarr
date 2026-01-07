import { db, schema } from '../../../db';
import { requireModeratorSession } from '../../../utils/adminAuth';
import { eq, desc, and, sql } from 'drizzle-orm';
import { checkAndMarkHnrs } from '../../../utils/hnr';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const query = getQuery(event);
  const status = query.status as string | undefined;
  const page = parseInt(query.page as string) || 1;
  const limit = Math.min(parseInt(query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  // Optionally trigger HnR check
  if (query.check === 'true') {
    await checkAndMarkHnrs();
  }

  const conditions = [];
  if (status === 'hnr') {
    conditions.push(eq(schema.hnrTracking.isHnr, true));
  } else if (status === 'pending') {
    conditions.push(
      and(
        eq(schema.hnrTracking.isHnr, false),
        sql`${schema.hnrTracking.completedAt} IS NULL`
      )
    );
  } else if (status === 'completed') {
    conditions.push(sql`${schema.hnrTracking.completedAt} IS NOT NULL`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [entries, countResult] = await Promise.all([
    db.query.hnrTracking.findMany({
      where: whereClause,
      with: {
        user: {
          columns: { id: true, username: true },
        },
        torrent: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [desc(schema.hnrTracking.downloadedAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.hnrTracking)
      .where(whereClause),
  ]);

  return {
    data: entries,
    pagination: {
      page,
      limit,
      total: countResult[0]?.count || 0,
      pages: Math.ceil((countResult[0]?.count || 0) / limit),
    },
  };
});
