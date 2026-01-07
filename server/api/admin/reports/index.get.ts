import { db, schema } from '../../../db';
import { requireModeratorSession } from '../../../utils/adminAuth';
import { eq, desc, and, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const query = getQuery(event);
  const status = query.status as string | undefined;
  const page = parseInt(query.page as string) || 1;
  const limit = Math.min(parseInt(query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
    conditions.push(eq(schema.reports.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [reports, countResult] = await Promise.all([
    db.query.reports.findMany({
      where: whereClause,
      with: {
        reporter: {
          columns: { id: true, username: true },
        },
        resolver: {
          columns: { id: true, username: true },
        },
      },
      orderBy: [desc(schema.reports.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.reports)
      .where(whereClause),
  ]);

  return {
    data: reports,
    pagination: {
      page,
      limit,
      total: countResult[0]?.count || 0,
      pages: Math.ceil((countResult[0]?.count || 0) / limit),
    },
  };
});
