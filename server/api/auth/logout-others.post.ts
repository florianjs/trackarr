import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { bumpedSessionVersion } from '../../utils/adminAuth';
import { protectEndpoint } from '../../utils/rateLimit';

/**
 * POST /api/auth/logout-others
 * Sign out everywhere else: bumping the session version revokes every session
 * cookie, then the current one is re-issued with the new version
 */
export default defineEventHandler(async (event) => {
  await protectEndpoint(event, 'mutation');
  const session = await requireAuthSession(event);

  // Bump only from the version this cookie was validated against: a concurrent
  // bump (another device, a ban) must not hand this request a fresh cookie
  const [updated] = await db
    .update(users)
    .set({ sessionVersion: bumpedSessionVersion() })
    .where(
      and(
        eq(users.id, session.user.id),
        eq(users.sessionVersion, session.sessionVersion ?? 0),
        eq(users.isBanned, false)
      )
    )
    .returning({ sessionVersion: users.sessionVersion });

  if (!updated) {
    throw createError({ statusCode: 401, message: 'Session expired, please sign in again' });
  }

  await setUserSession(event, { ...session, sessionVersion: updated.sessionVersion });

  return { success: true };
});
