import { asc } from 'drizzle-orm';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { ensureDefaultChannels } from '../../../../utils/shoutbox';

/**
 * GET /api/admin/shoutbox/channels
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  await ensureDefaultChannels();
  return db
    .select()
    .from(schema.shoutChannels)
    .orderBy(asc(schema.shoutChannels.position), asc(schema.shoutChannels.createdAt));
});
