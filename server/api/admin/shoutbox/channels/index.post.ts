import { randomUUID } from 'crypto';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { validateBody } from '../../../../utils/schemas';
import { channelSlug } from '../../../../utils/shoutboxRules';
import { channelSchema } from '../../../../utils/shoutboxSchemas';

/**
 * POST /api/admin/shoutbox/channels
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const input = await validateBody(event, channelSchema);

  const base = channelSlug(input.name) || 'channel';
  const id = randomUUID();
  const [created] = await db
    .insert(schema.shoutChannels)
    .values({
      id,
      // Unique even when two channels share a name
      slug: `${base}-${id.slice(0, 6)}`,
      ...input,
      description: input.description || null,
      roleIds: input.readAccess === 'roles' ? input.roleIds : [],
    })
    .returning();
  return created;
});
