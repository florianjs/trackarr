import { eq } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { removeAvatarFile } from '~~/server/utils/uploads';
import { requireModerationTarget } from '~~/server/utils/userModeration';

/**
 * DELETE /api/mod/users/:id/avatar
 * Remove a member's avatar (offensive picture)
 */
export default defineEventHandler(async (event) => {
  const { target } = await requireModerationTarget(event, 'moderate');

  await db.update(schema.users).set({ avatarUrl: null }).where(eq(schema.users.id, target.id));
  await removeAvatarFile(target.avatarUrl);

  return { success: true };
});
