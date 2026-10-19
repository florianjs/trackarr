import { eq } from 'drizzle-orm';
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

  const [updated] = await db
    .update(users)
    .set({ sessionVersion: bumpedSessionVersion() })
    .where(eq(users.id, session.user.id))
    .returning({ sessionVersion: users.sessionVersion });

  await setUserSession(event, { ...session, sessionVersion: updated!.sessionVersion });

  return { success: true };
});
