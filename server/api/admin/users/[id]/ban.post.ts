import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { users, bannedIps } from '~~/server/db/schema';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import {
  validateBody,
  validateParam,
  adminBanSchema,
  uuidSchema,
} from '~~/server/utils/schemas';
import { invalidateTrackerUsers } from '~~/server/tracker/lookups';
import { invalidateBannedIps } from '~~/server/utils/bannedIps';

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);

  // Validate user ID parameter
  const userId = validateParam(event, 'id', uuidSchema);

  // Validate request body
  const body = await validateBody(event, adminBanSchema);
  const reason = body.reason || 'Banned by admin';

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

  if (user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Cannot ban an admin',
    });
  }

  if (user.id === session.user.id) {
    throw createError({
      statusCode: 400,
      message: 'Cannot ban yourself',
    });
  }

  // Moderators can only act on regular users
  if (user.isModerator && !session.user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Only admins can ban moderators',
    });
  }

  // Update user status
  await db.update(users).set({ isBanned: true }).where(eq(users.id, userId));

  // Ban their IP if available
  if (user.lastIp) {
    await db
      .insert(bannedIps)
      .values({
        ip: user.lastIp,
        reason: `Banned user: ${user.username}. Reason: ${reason}`,
      })
      .onConflictDoUpdate({
        target: bannedIps.ip,
        set: { reason: `Banned user: ${user.username}. Reason: ${reason}` },
      });
  }

  // Tracker caches the row for a few seconds
  invalidateTrackerUsers();
  invalidateBannedIps();

  return { success: true };
});
