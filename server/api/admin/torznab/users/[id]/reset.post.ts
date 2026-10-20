/**
 * POST /api/admin/torznab/users/:id/reset
 * Reset a user's passkey and revoke their Torznab API key (admin only)
 */

import { requireAdminSession } from '../../../../../utils/adminAuth';
import { db, schema } from '../../../../../db';
import { eq } from 'drizzle-orm';
import { generatePasskey } from '../../../../../utils/auth';
import { clearTorznabUserStats, copyTorznabBlock, unblockTorznabUser } from '../../../../../utils/torznabStats';
import { invalidateTrackerUsers } from '~~/server/tracker/client';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const userId = getRouterParam(event, 'id');

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    });
  }

  // Get current user
  const existingUsers = await db
    .select({ passkey: schema.users.passkey, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (existingUsers.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  const oldPasskey = existingUsers[0].passkey;

  // Generate new passkey; an API block follows it (copied first, see
  // copyTorznabBlock)
  const newPasskey = generatePasskey();
  const wasBlocked = await copyTorznabBlock(oldPasskey, newPasskey);

  // Revoke the API key too: indexers stop working until the user takes a new one
  await db
    .update(schema.users)
    .set({ passkey: newPasskey, apiKey: null })
    .where(eq(schema.users.id, userId));

  // Clear old stats
  if (wasBlocked) await unblockTorznabUser(oldPasskey);
  await clearTorznabUserStats(oldPasskey);

  // Tracker caches the row for a few seconds
  invalidateTrackerUsers();

  return {
    success: true,
    message: `Passkey reset for user ${existingUsers[0].username}`,
    passkeyMasked: `${newPasskey.substring(0, 8)}...${newPasskey.substring(36)}`,
  };
});
