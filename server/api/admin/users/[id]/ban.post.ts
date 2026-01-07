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

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

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

  return { success: true };
});
