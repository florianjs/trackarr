import { eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { bumpChannelVersion, requireReadableMessage, requireShoutViewer } from '../../../utils/shoutbox';
import { canDeleteShout } from '../../../utils/shoutboxRules';

/**
 * DELETE /api/shoutbox/messages/:id
 * Authors remove their own messages, staff remove any (soft delete)
 */
export default defineEventHandler(async (event) => {
  const viewer = await requireShoutViewer(event);
  const { message } = await requireReadableMessage(event, viewer);
  if (!canDeleteShout(message, viewer)) {
    throw createError({ statusCode: 403, message: 'You cannot delete this message' });
  }
  if (message.deletedAt) return { ok: true };

  await db
    .update(schema.shoutMessages)
    .set({ deletedAt: new Date(), deletedBy: viewer.id })
    .where(eq(schema.shoutMessages.id, message.id));
  // Reactions go with the text
  await db.delete(schema.shoutReactions).where(eq(schema.shoutReactions.messageId, message.id));
  await bumpChannelVersion(message.channelId);
  return { ok: true };
});
