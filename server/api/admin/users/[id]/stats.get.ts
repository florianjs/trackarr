import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '~~/server/db';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { uuidSchema, validateParam } from '~~/server/utils/schemas';

const admins = alias(schema.users, 'admins');

/**
 * GET /api/admin/users/:id/stats
 * Uploaded/downloaded totals and the last admin corrections (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const userId = validateParam(event, 'id', uuidSchema);

  const [user] = await db
    .select({ uploaded: schema.users.uploaded, downloaded: schema.users.downloaded })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) throw createError({ statusCode: 404, message: 'User not found' });

  const adjustments = await db
    .select({
      id: schema.statAdjustments.id,
      uploadedDelta: schema.statAdjustments.uploadedDelta,
      downloadedDelta: schema.statAdjustments.downloadedDelta,
      reason: schema.statAdjustments.reason,
      createdAt: schema.statAdjustments.createdAt,
      admin: admins.username,
    })
    .from(schema.statAdjustments)
    .leftJoin(admins, eq(admins.id, schema.statAdjustments.adminId))
    .where(eq(schema.statAdjustments.userId, userId))
    .orderBy(desc(schema.statAdjustments.createdAt))
    .limit(20);

  return { ...user, adjustments };
});
