import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { uuidSchema, validateBody, validateParam } from '~~/server/utils/schemas';
import { invalidateTrackerUsers } from '~~/server/tracker/client';
import { statAdjustmentSchema } from '~~/shared/utils/statAdjust';

/**
 * POST /api/admin/users/:id/stats
 * Add to or remove from a member's uploaded/downloaded totals, logged with
 * the admin and the reason (admin only)
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const userId = validateParam(event, 'id', uuidSchema);
  const { uploadedDelta, downloadedDelta, reason } = await validateBody(event, statAdjustmentSchema);

  const result = await db.transaction(async (tx) => {
    // Lock the row: the tracker adds its traffic as deltas too, so neither
    // write is lost, and the logged deltas are the ones really applied
    const [before] = await tx
      .select({ uploaded: schema.users.uploaded, downloaded: schema.users.downloaded })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for('update');
    if (!before) throw createError({ statusCode: 404, message: 'User not found' });

    const [after] = await tx
      .update(schema.users)
      .set({
        uploaded: sql`greatest(0, ${schema.users.uploaded} + ${uploadedDelta})`,
        downloaded: sql`greatest(0, ${schema.users.downloaded} + ${downloadedDelta})`,
      })
      .where(eq(schema.users.id, userId))
      .returning({ uploaded: schema.users.uploaded, downloaded: schema.users.downloaded });

    const applied = {
      uploadedDelta: after!.uploaded - before.uploaded,
      downloadedDelta: after!.downloaded - before.downloaded,
    };
    if (applied.uploadedDelta === 0 && applied.downloadedDelta === 0) {
      throw createError({ statusCode: 400, message: 'Nothing to remove: the totals are already 0' });
    }

    await tx.insert(schema.statAdjustments).values({
      id: randomUUID(),
      userId,
      adminId: session.user.id,
      ...applied,
      reason,
    });

    return { ...after!, ...applied };
  });

  // The tracker caches user rows (ratio checks) for a few seconds
  invalidateTrackerUsers();

  return result;
});
