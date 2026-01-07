import { db, schema } from '../../../db';
import { requireModeratorSession } from '../../../utils/adminAuth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.string().max(500).optional(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireModeratorSession(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: 'Report ID required' });
  }

  const body = await readBody(event);
  const data = resolveReportSchema.parse(body);

  const report = await db.query.reports.findFirst({
    where: eq(schema.reports.id, id),
  });

  if (!report) {
    throw createError({ statusCode: 404, message: 'Report not found' });
  }

  const updated = await db
    .update(schema.reports)
    .set({
      status: data.status,
      resolution: data.resolution || null,
      resolvedBy: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(schema.reports.id, id))
    .returning();

  return updated[0];
});
