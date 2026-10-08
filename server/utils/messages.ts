/**
 * Private messages: membership checks, blocks and sending.
 * Only the two participants can read a conversation; staff roles grant no
 * access here.
 */

import type { H3Event } from 'h3';
import { randomUUID } from 'crypto';
import { and, eq, or } from 'drizzle-orm';
import { db, schema } from '../db';
import { normalizeMessageBody, pairKey } from './messageRules';
import { validateParam, uuidSchema } from './schemas';

/**
 * Load a conversation the current user belongs to, or 404 (never reveal
 * whether a conversation exists)
 */
export async function requireConversation(event: H3Event) {
  const { user } = await requireAuthSession(event);
  const conversationId = validateParam(event, 'id', uuidSchema);

  const members = await db
    .select({ userId: schema.conversationMembers.userId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));

  if (!members.some((m) => m.userId === user.id)) {
    throw createError({ statusCode: 404, message: 'Conversation not found' });
  }

  const otherUserId = members.find((m) => m.userId !== user.id)?.userId ?? null;
  return { user, conversationId, otherUserId };
}

/** Block state between two users, in both directions */
export async function getBlockState(userId: string, otherId: string) {
  const rows = await db
    .select({ blockerId: schema.userBlocks.blockerId })
    .from(schema.userBlocks)
    .where(
      or(
        and(eq(schema.userBlocks.blockerId, userId), eq(schema.userBlocks.blockedId, otherId)),
        and(eq(schema.userBlocks.blockerId, otherId), eq(schema.userBlocks.blockedId, userId))
      )
    );
  return {
    iBlocked: rows.some((r) => r.blockerId === userId),
    blockedMe: rows.some((r) => r.blockerId === otherId),
  };
}

export function parseBodyOrThrow(raw: unknown): string {
  const body = normalizeMessageBody(raw);
  if (!body) {
    throw createError({ statusCode: 400, message: 'Message must be between 1 and 5000 characters' });
  }
  return body;
}

/**
 * Send a message to `recipientId`, creating the conversation on first
 * contact. Returns the conversation id.
 */
export async function sendPrivateMessage(senderId: string, recipientId: string, body: string) {
  if (senderId === recipientId) {
    throw createError({ statusCode: 400, message: 'You cannot message yourself' });
  }

  // Covers both entry points: new conversation by username and reply by id
  const recipient = await db.query.users.findFirst({
    where: eq(schema.users.id, recipientId),
    columns: { isBanned: true },
  });
  if (!recipient || recipient.isBanned) {
    throw createError({ statusCode: 404, message: 'No member with this username' });
  }

  const block = await getBlockState(senderId, recipientId);
  if (block.blockedMe) {
    throw createError({ statusCode: 403, message: 'This member does not accept your messages' });
  }
  if (block.iBlocked) {
    throw createError({ statusCode: 403, message: 'Unblock this member to send a message' });
  }

  const key = pairKey(senderId, recipientId);
  const now = new Date();

  return db.transaction(async (tx) => {
    // Create the conversation once per pair; concurrent first messages share it
    await tx
      .insert(schema.conversations)
      .values({ id: randomUUID(), pairKey: key, lastMessageAt: now })
      .onConflictDoNothing({ target: schema.conversations.pairKey });

    const [conversation] = await tx
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(eq(schema.conversations.pairKey, key));
    const conversationId = conversation!.id;

    await tx
      .insert(schema.conversationMembers)
      .values([
        { conversationId, userId: senderId },
        { conversationId, userId: recipientId },
      ])
      .onConflictDoNothing();

    await tx.insert(schema.privateMessages).values({
      id: randomUUID(),
      conversationId,
      senderId,
      body,
      createdAt: now,
    });

    await tx
      .update(schema.conversations)
      .set({ lastMessageAt: now })
      .where(eq(schema.conversations.id, conversationId));

    // The sender has read their own message
    await tx
      .update(schema.conversationMembers)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, senderId)
        )
      );

    return conversationId;
  });
}
