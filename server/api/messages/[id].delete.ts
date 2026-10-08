import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { requireConversation } from '../../utils/messages';

/**
 * DELETE /api/messages/:id
 * Hide a conversation for me only; it comes back if a new message arrives
 */
export default defineEventHandler(async (event) => {
  const { user, conversationId } = await requireConversation(event);
  await db
    .update(schema.conversationMembers)
    .set({ hiddenAt: new Date() })
    .where(
      and(
        eq(schema.conversationMembers.conversationId, conversationId),
        eq(schema.conversationMembers.userId, user.id)
      )
    );
  return { success: true };
});
