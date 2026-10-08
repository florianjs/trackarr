/**
 * POST /api/admin/torznab/users/:id/reset
 * Reset a user's passkey (regenerate) (admin only)
 */

import { requireAdminSession } from '../../../../../utils/adminAuth';
import { db, schema } from '../../../../../db';
import { eq } from 'drizzle-orm';
import { generatePasskey } from '../../../../../utils/auth';
import { clearTorznabUserStats } from '../../../../../utils/torznabStats';
import { invalidateTrackerUsers } from '~~/server/tracker/lookups';

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

  // Generate new passkey
  const newPasskey = generatePasskey();

  // Update user
  await db
    .update(schema.users)
    .set({ passkey: newPasskey })
    .where(eq(schema.users.id, userId));

  // Clear old stats
  await clearTorznabUserStats(oldPasskey);

  // Tracker caches the row for a few seconds
  invalidateTrackerUsers();

  return {
    success: true,
    message: `Passkey reset for user ${existingUsers[0].username}`,
    passkeyMasked: `${newPasskey.substring(0, 8)}...${newPasskey.substring(36)}`,
  };
});
