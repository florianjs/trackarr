import { eq } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { uuidSchema, validateParam } from '~~/server/utils/schemas';

/**
 * DELETE /api/mod/shoutbox/mutes/:userId
 * Lift a shoutbox mute
 */
export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const userId = validateParam(event, 'userId', uuidSchema);
  await db.delete(schema.shoutMutes).where(eq(schema.shoutMutes.userId, userId));
  return { ok: true };
});
