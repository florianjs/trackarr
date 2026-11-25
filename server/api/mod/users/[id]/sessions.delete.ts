import { eq } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { bumpedSessionVersion } from '~~/server/utils/adminAuth';
import { requireModerationTarget } from '~~/server/utils/userModeration';

/**
 * DELETE /api/mod/users/:id/sessions
 * Sign the member out everywhere (e.g. a shared or stolen account)
 */
export default defineEventHandler(async (event) => {
  const { target } = await requireModerationTarget(event, 'moderate');

  await db
    .update(schema.users)
    .set({ sessionVersion: bumpedSessionVersion() })
    .where(eq(schema.users.id, target.id));

  return { success: true };
});
