import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export const authUserColumns = {
  isBanned: users.isBanned,
  isAdmin: users.isAdmin,
  isModerator: users.isModerator,
  passkey: users.passkey,
};

export interface AuthUserState {
  isBanned: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  passkey: string;
}

/**
 * Require user authentication and check for bans
 */
export async function requireAuthSession(event: H3Event) {
  const session = await requireUserSession(event);

  // Roles come from the DB, never from the cookie: a demoted admin keeps an
  // old sealed cookie with isAdmin=true. Reuse the middleware lookup if done.
  let dbUser = event.context.authUser as AuthUserState | undefined;

  if (!dbUser) {
    [dbUser] = await db
      .select(authUserColumns)
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
  }

  if (!dbUser || dbUser.isBanned) {
    await clearUserSession(event);
    throw createError({
      statusCode: 403,
      message: 'Your account has been banned',
    });
  }

  event.context.authUser = dbUser;
  session.user.isAdmin = dbUser.isAdmin;
  session.user.isModerator = dbUser.isModerator;

  return session;
}

/**
 * Require authentication and return the user's current tracker passkey.
 * The passkey is read from the DB, never stored in the client-visible session.
 */
export async function requireUserPasskey(event: H3Event): Promise<string> {
  await requireAuthSession(event);
  return (event.context.authUser as AuthUserState).passkey;
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
