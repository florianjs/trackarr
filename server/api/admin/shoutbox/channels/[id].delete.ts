import { eq } from 'drizzle-orm';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { uuidSchema, validateParam } from '../../../../utils/schemas';

/**
 * DELETE /api/admin/shoutbox/channels/:id
 * Removes the channel and its messages
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  await db.delete(schema.shoutChannels).where(eq(schema.shoutChannels.id, id));
  return { ok: true };
});
