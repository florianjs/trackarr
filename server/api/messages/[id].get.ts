import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { getBlockState, requireConversation } from '../../utils/messages';
import { validateQuery } from '../../utils/schemas';

const querySchema = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/messages/:id
 * Messages of a conversation (oldest first, paginated backwards with
 * ?before=), and marks it read
 */
export default defineEventHandler(async (event) => {
  const { user, conversationId, otherUserId } = await requireConversation(event);
  const query = validateQuery(event, querySchema);
  const pm = schema.privateMessages;

  const conditions = [eq(pm.conversationId, conversationId)];
  if (query.before) conditions.push(lt(pm.createdAt, new Date(query.before)));

  const [rows, other, block] = await Promise.all([
    db
      .select({ id: pm.id, senderId: pm.senderId, body: pm.body, createdAt: pm.createdAt })
      .from(pm)
      .where(and(...conditions))
      .orderBy(desc(pm.createdAt))
      .limit(query.limit + 1),
    otherUserId
      ? db.query.users.findFirst({
          where: eq(schema.users.id, otherUserId),
          columns: { id: true, username: true, avatarUrl: true },
        })
      : null,
    otherUserId ? getBlockState(user.id, otherUserId) : { iBlocked: false, blockedMe: false },
  ]);

  // Opening the latest page marks the conversation read up to the newest
  // message shown (a message arriving right after stays unread)
  if (!query.before && rows[0]) {
    await db
      .update(schema.conversationMembers)
      .set({ lastReadAt: rows[0].createdAt })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, user.id)
        )
      );
  }

  const hasMore = rows.length > query.limit;
  return {
    id: conversationId,
    other: other ?? null,
    iBlocked: block.iBlocked,
    blockedMe: block.blockedMe,
    hasMore,
    messages: rows.slice(0, query.limit).reverse().map((m) => ({
      ...m,
      mine: m.senderId === user.id,
    })),
  };
});
