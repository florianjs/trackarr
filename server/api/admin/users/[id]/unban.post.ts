import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { users, bannedIps } from '~~/server/db/schema';
import { requireModeratorSession } from '~~/server/utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const userId = getRouterParam(event, 'id');

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    });
  }

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

  // Update user status
  await db.update(users).set({ isBanned: false }).where(eq(users.id, userId));

  // Unban their IP if available
  if (user.lastIp) {
    await db.delete(bannedIps).where(eq(bannedIps.ip, user.lastIp));
  }

  return { success: true };
});
