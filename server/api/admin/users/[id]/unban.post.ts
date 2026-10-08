import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { users, bannedIps } from '~~/server/db/schema';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { validateParam, uuidSchema } from '~~/server/utils/schemas';

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const userId = validateParam(event, 'id', uuidSchema);

  // Get user to find their IP
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  // Moderators can only act on regular users
  if ((user.isModerator || user.isAdmin) && !session.user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Only admins can unban moderators',
    });
  }

  // Update user status
  await db.update(users).set({ isBanned: false }).where(eq(users.id, userId));

  // Unban their IP if available
  if (user.lastIp) {
    await db.delete(bannedIps).where(eq(bannedIps.ip, user.lastIp));
  }

  return { success: true };
});
