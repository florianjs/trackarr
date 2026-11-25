import { eq } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { generatePasskey } from '~~/server/utils/auth';
import { bumpedSessionVersion } from '~~/server/utils/adminAuth';
import { removeAvatarFile } from '~~/server/utils/uploads';
import { requireModerationTarget } from '~~/server/utils/userModeration';
import { clearTorznabUserStats, unblockTorznabUser } from '~~/server/utils/torznabStats';
import { invalidateTrackerUsers } from '~~/server/tracker/client';
import { deletedUsername } from '~~/shared/utils/userModeration';

/**
 * DELETE /api/admin/users/:id
 * Delete an account (admin only). The row is anonymised rather than removed:
 * torrents, forum posts and comments keep an author, but the account can no
 * longer sign in or announce, and the username is freed.
 */
export default defineEventHandler(async (event) => {
  const { target } = await requireModerationTarget(event, 'delete');

  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({
        username: deletedUsername(target.id),
        authSalt: null,
        authVerifier: null,
        panicPasswordHash: null,
        passkey: generatePasskey(),
        apiKey: null,
        isAdmin: false,
        isModerator: false,
        isBanned: true,
        roleId: null,
        lastIp: null,
        avatarUrl: null,
        invitesRemaining: 0,
        sessionVersion: bumpedSessionVersion(),
      })
      .where(eq(schema.users.id, target.id));
    await tx.delete(schema.shoutMutes).where(eq(schema.shoutMutes.userId, target.id));
  });

  await removeAvatarFile(target.avatarUrl);
  await unblockTorznabUser(target.passkey);
  await clearTorznabUserStats(target.passkey);
  invalidateTrackerUsers();

  return { success: true, username: deletedUsername(target.id) };
});
