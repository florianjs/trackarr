import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../../../db';
import { rateLimit, RATE_LIMITS } from '../../../../utils/rateLimit';
import { validateBody } from '../../../../utils/schemas';
import { bumpChannelVersion, requireReadableMessage, requireShoutViewer } from '../../../../utils/shoutbox';
import { canReactChannel, parseReactionEmoji, MAX_DISTINCT_REACTIONS } from '../../../../utils/shoutboxRules';

const bodySchema = z.object({ emoji: z.string().max(32) });

/**
 * POST /api/shoutbox/messages/:id/reactions
 * Toggle the member's reaction with this emoji
 */
export default defineEventHandler(async (event) => {
  const viewer = await requireShoutViewer(event);
  const { message, channel } = await requireReadableMessage(event, viewer);
  if (!canReactChannel(channel, viewer) || message.deletedAt) {
    throw createError({ statusCode: 403, message: 'You cannot react to this message' });
  }
  await rateLimit(event, RATE_LIMITS.shoutReact);

  const { emoji: raw } = await validateBody(event, bodySchema);
  const emoji = parseReactionEmoji(raw);
  if (!emoji) {
    throw createError({ statusCode: 400, message: 'A reaction is a single emoji' });
  }

  const r = schema.shoutReactions;
  const mine = and(eq(r.messageId, message.id), eq(r.userId, viewer.id), eq(r.emoji, emoji));
  const removed = await db.delete(r).where(mine).returning({ emoji: r.emoji });

  if (removed.length === 0) {
    const used = await db.selectDistinct({ emoji: r.emoji }).from(r).where(eq(r.messageId, message.id));
    if (!used.some((u) => u.emoji === emoji) && used.length >= MAX_DISTINCT_REACTIONS) {
      throw createError({ statusCode: 400, message: 'Too many different reactions on this message' });
    }
    await db.insert(r).values({ messageId: message.id, userId: viewer.id, emoji }).onConflictDoNothing();
  }

  await bumpChannelVersion(message.channelId);
  return { reacted: removed.length === 0 };
});
