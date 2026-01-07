import { count, eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { getSetting, SETTINGS_KEYS, isInviteEnabled } from '../../utils/settings';
import type { PublicUser } from '~~/types/auth';

/**
 * GET /api/auth/status
 * Returns authentication status and tracker state
 */
export default defineEventHandler(async (event) => {
  // Check if any users exist
  const userCount = await db.select({ count: count() }).from(users);
  const hasUsers = userCount[0].count > 0;

  // Get current user session
  const session = await getUserSession(event);

  // Get registration status
  const registrationOpen = await getSetting(SETTINGS_KEYS.REGISTRATION_OPEN);
  const inviteEnabled = await isInviteEnabled();

  let publicUser: PublicUser | null = null;

  if (session.user) {
    // Fetch latest stats and roles from DB to ensure they are up to date
    const [dbUser] = await db
      .select({
        uploaded: users.uploaded,
        downloaded: users.downloaded,
        isBanned: users.isBanned,
        isAdmin: users.isAdmin,
        isModerator: users.isModerator,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (dbUser) {
      // Check if user is banned
      if (dbUser.isBanned) {
        await clearUserSession(event);
        publicUser = null;
      } else {
        // Update session if stats or roles changed
        if (
          dbUser.uploaded !== session.user.uploaded ||
          dbUser.downloaded !== session.user.downloaded ||
          dbUser.isAdmin !== session.user.isAdmin ||
          dbUser.isModerator !== session.user.isModerator
        ) {
          await setUserSession(event, {
            ...session,
            user: {
              ...session.user,
              uploaded: dbUser.uploaded,
              downloaded: dbUser.downloaded,
              isAdmin: dbUser.isAdmin,
              isModerator: dbUser.isModerator,
            },
          });
        }

        publicUser = {
          id: session.user.id,
          username: session.user.username,
          isAdmin: dbUser.isAdmin,
          isModerator: dbUser.isModerator,
          uploaded: dbUser.uploaded,
          downloaded: dbUser.downloaded,
        };
      }
    } else {
      // User not found in DB, clear session
      await clearUserSession(event);
      publicUser = null;
    }
  }

  return {
    // If no users exist, show setup page
    needsSetup: !hasUsers,
    // Current user info (null if not logged in) - passkey excluded
    user: publicUser,
    // Whether new registrations are allowed
    registrationOpen: registrationOpen === 'true',
    inviteEnabled,
  };
});
