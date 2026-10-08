import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db, schema } from '../../db';
import { isConversationUnread, isConversationVisible } from '../../utils/messageRules';

/**
 * GET /api/messages
 * My conversations, most recent first, with the other member and a preview
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  const { conversations: c, conversationMembers: cm, privateMessages: pm, users } = schema;

  const memberships = await db
    .select({
      id: c.id,
      lastMessageAt: c.lastMessageAt,
      lastReadAt: cm.lastReadAt,
      hiddenAt: cm.hiddenAt,
    })
    .from(cm)
    .innerJoin(c, eq(c.id, cm.conversationId))
    .where(eq(cm.userId, user.id))
    .orderBy(desc(c.lastMessageAt))
    .limit(100);

  const visible = memberships.filter(isConversationVisible);
  if (visible.length === 0) return [];
  const ids = visible.map((m) => m.id);

  const [others, lastMessages] = await Promise.all([
    db
      .select({
        conversationId: cm.conversationId,
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(cm)
      .innerJoin(users, eq(users.id, cm.userId))
      .where(and(inArray(cm.conversationId, ids), ne(cm.userId, user.id))),
    db
      .selectDistinctOn([pm.conversationId], {
        conversationId: pm.conversationId,
        senderId: pm.senderId,
        body: pm.body,
      })
      .from(pm)
      .where(inArray(pm.conversationId, ids))
      .orderBy(pm.conversationId, desc(pm.createdAt)),
  ]);

  const otherBy = new Map(others.map((o) => [o.conversationId, o]));
  const lastBy = new Map(lastMessages.map((m) => [m.conversationId, m]));

  return visible.map((m) => {
    const last = lastBy.get(m.id);
    const other = otherBy.get(m.id);
    return {
      id: m.id,
      lastMessageAt: m.lastMessageAt,
      other: other ? { id: other.id, username: other.username, avatarUrl: other.avatarUrl } : null,
      preview: last ? last.body.slice(0, 140) : '',
      lastFromMe: last?.senderId === user.id,
      unread: isConversationUnread({
        userId: user.id,
        lastSenderId: last?.senderId ?? null,
        lastMessageAt: m.lastMessageAt,
        lastReadAt: m.lastReadAt,
      }),
    };
  });
});
