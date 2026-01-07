import { db, schema } from '../../../db';
import { desc, asc, gte } from 'drizzle-orm';
import { requireAdminSession } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const query = getQuery(event);
  const days = parseInt(query.days as string) || 7;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const history = await db
    .select()
    .from(schema.siteStats)
    .where(gte(schema.siteStats.createdAt, startDate))
    .orderBy(asc(schema.siteStats.createdAt));

  return history;
});
