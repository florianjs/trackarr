import { eq } from 'drizzle-orm';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { uuidSchema, validateBody, validateParam } from '../../../../utils/schemas';
import { bumpChannelVersion } from '../../../../utils/shoutbox';
import { channelSchema } from '../../../../utils/shoutboxSchemas';

/**
 * PUT /api/admin/shoutbox/channels/:id
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  const input = await validateBody(event, channelSchema);

  const [updated] = await db
    .update(schema.shoutChannels)
    .set({
      ...input,
      description: input.description || null,
      roleIds: input.readAccess === 'roles' ? input.roleIds : [],
    })
    .where(eq(schema.shoutChannels.id, id))
    .returning();
  if (!updated) {
    throw createError({ statusCode: 404, message: 'Channel not found' });
  }
  // Open clients refresh their rights (posting, reactions)
  await bumpChannelVersion(id);
  return updated;
});
