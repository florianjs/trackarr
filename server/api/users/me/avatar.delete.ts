import { eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { removeAvatarFile } from '../../../utils/uploadsDir';

/**
 * DELETE /api/users/me/avatar
 * Remove the current user's avatar
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);

  const account = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { avatarUrl: true },
  });

  await db
    .update(schema.users)
    .set({ avatarUrl: null })
    .where(eq(schema.users.id, user.id));

  await removeAvatarFile(account?.avatarUrl);

  return { success: true };
});
