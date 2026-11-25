import { and, eq } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { generatePasskey } from '~~/server/utils/auth';
import { requireModerationTarget } from '~~/server/utils/userModeration';
import { clearTorznabUserStats, copyTorznabBlock, unblockTorznabUser } from '~~/server/utils/torznabStats';
import { invalidateTrackerUsers } from '~~/server/tracker/client';

/**
 * POST /api/admin/users/:id/passkey
 * Reset a member's passkey (leaked announce URL, shared account). Their
 * torrents must be downloaded again. Same steps as the self-service reset.
 */
export default defineEventHandler(async (event) => {
  const { target } = await requireModerationTarget(event, 'edit');
  const oldPasskey = target.passkey;
  const passkey = generatePasskey();

  // Keep an API block across the reset; copied first so a Redis failure
  // aborts the reset instead of lifting the block
  const wasBlocked = await copyTorznabBlock(oldPasskey, passkey);

  const [updated] = await db
    .update(schema.users)
    .set({ passkey })
    .where(and(eq(schema.users.id, target.id), eq(schema.users.passkey, oldPasskey)))
    .returning({ id: schema.users.id });
  if (!updated) {
    throw createError({ statusCode: 409, message: 'Passkey changed meanwhile, reload the page' });
  }

  if (wasBlocked) await unblockTorznabUser(oldPasskey);
  await clearTorznabUserStats(oldPasskey);
  invalidateTrackerUsers();

  return { success: true };
});
