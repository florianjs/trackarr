import { desc, eq } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { requireAuthSession } from '~~/server/utils/adminAuth';

/**
 * GET /api/auth/appeal
 * Hold state of the signed-in account and its appeals (newest first)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event, { allowIpHold: true });

  const appeals = await db
    .select({
      id: schema.ipAppeals.id,
      message: schema.ipAppeals.message,
      status: schema.ipAppeals.status,
      staffNote: schema.ipAppeals.staffNote,
      createdAt: schema.ipAppeals.createdAt,
      reviewedAt: schema.ipAppeals.reviewedAt,
    })
    .from(schema.ipAppeals)
    .where(eq(schema.ipAppeals.userId, user.id))
    .orderBy(desc(schema.ipAppeals.createdAt))
    .limit(10);

  const held = Boolean((event.context.authUser as { ipHold?: boolean } | undefined)?.ipHold);
  return { held, appeals };
});
