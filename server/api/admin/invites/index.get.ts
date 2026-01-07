import { db, schema } from '../../../db';
import { requireAdminSession } from '../../../utils/adminAuth';
import { desc, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = Math.min(parseInt(query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  const [invites, countResult] = await Promise.all([
    db.query.invitations.findMany({
      with: {
        creator: {
          columns: { id: true, username: true },
        },
        usedByUser: {
          columns: { id: true, username: true },
        },
      },
      orderBy: [desc(schema.invitations.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.invitations),
  ]);

  return {
    data: invites,
    pagination: {
      page,
      limit,
      total: countResult[0]?.count || 0,
      pages: Math.ceil((countResult[0]?.count || 0) / limit),
    },
  };
});
