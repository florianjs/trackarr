import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { uuidSchema, validateBody } from '../../utils/schemas';

const blockSchema = z.object({ userId: uuidSchema, blocked: z.boolean() });

/**
 * POST /api/messages/block
 * Block or unblock a member: a blocked member cannot send me messages
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  const { userId, blocked } = await validateBody(event, blockSchema);

  if (userId === user.id) {
    throw createError({ statusCode: 400, message: 'You cannot block yourself' });
  }

  if (blocked) {
    await db
      .insert(schema.userBlocks)
      .values({ blockerId: user.id, blockedId: userId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(schema.userBlocks)
      .where(and(eq(schema.userBlocks.blockerId, user.id), eq(schema.userBlocks.blockedId, userId)));
  }
  return { success: true, blocked };
});
