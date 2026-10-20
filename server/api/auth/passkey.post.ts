import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { generatePasskey } from '../../utils/auth';
import { protectEndpoint } from '../../utils/rateLimit';
import { clearTorznabUserStats, copyTorznabBlock, unblockTorznabUser } from '../../utils/torznabStats';
import { invalidateTrackerUsers } from '../../tracker/client';

/**
 * POST /api/auth/passkey
 * Reset the current user's passkey, e.g. after a leak. Torrents downloaded
 * before keep the old one in their announce URL and stop working until they
 * are downloaded again.
 */
export default defineEventHandler(async (event) => {
  await protectEndpoint(event, 'mutation');
  const session = await requireAuthSession(event);
  const oldPasskey = await requireUserPasskey(event);

  const passkey = generatePasskey();
  // An admin's API block must survive the reset: copied first, so a Redis
  // failure aborts the reset instead of lifting the block
  const wasBlocked = await copyTorznabBlock(oldPasskey, passkey);

  // Only from the passkey this request was checked against: two resets at
  // once must not both report success with different keys
  const [updated] = await db
    .update(users)
    .set({ passkey })
    .where(and(eq(users.id, session.user.id), eq(users.passkey, oldPasskey)))
    .returning({ passkey: users.passkey });
  if (!updated) {
    throw createError({ statusCode: 409, message: 'Passkey changed meanwhile, reload the page' });
  }

  // Request stats start over; the old passkey is gone from the block list
  if (wasBlocked) await unblockTorznabUser(oldPasskey);
  await clearTorznabUserStats(oldPasskey);

  // The tracker caches user rows by passkey for a few seconds
  invalidateTrackerUsers();

  return { passkey };
});
