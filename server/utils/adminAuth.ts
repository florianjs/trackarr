import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

/**
 * Require user authentication and check for bans
 */
export async function requireAuthSession(event: H3Event) {
  const session = await requireUserSession(event);

  // Skip DB check if already verified by middleware
  if (event.context.authChecked) {
    return session;
  }

  // Check DB for ban status to ensure banned users are immediately blocked
  const [dbUser] = await db
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!dbUser || dbUser.isBanned) {
    await clearUserSession(event);
    throw createError({
      statusCode: 403,
      message: 'Your account has been banned',
    });
  }

  // Mark as checked
  event.context.authChecked = true;

  return session;
}

/**
 * Require moderator or admin authentication
 */
export async function requireModeratorSession(event: H3Event) {
  const session = await requireAuthSession(event);

  if (!session.user?.isAdmin && !session.user?.isModerator) {
    throw createError({
      statusCode: 403,
      message: 'Moderator access required',
    });
  }

  return session;
}

/**
 * Require admin authentication
 * Uses requireAuthSession and checks isAdmin flag
 */
export async function requireAdminSession(event: H3Event) {
  const session = await requireAuthSession(event);

  if (!session.user?.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    });
  }

  return session;
}
