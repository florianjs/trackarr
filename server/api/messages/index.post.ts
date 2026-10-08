import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { parseBodyOrThrow, sendPrivateMessage } from '../../utils/messages';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';
import { validateBody } from '../../utils/schemas';

const sendSchema = z.object({
  to: z.string().trim().min(1).max(50),
  body: z.string().max(10000),
});

/**
 * POST /api/messages
 * Send a message to a member (by username); starts the conversation on first contact
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  await rateLimit(event, RATE_LIMITS.mutation);
  const { to, body } = await validateBody(event, sendSchema);
  const text = parseBodyOrThrow(body);

  const [recipient] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.username})`, to.toLowerCase()))
    .limit(1);
  if (!recipient) {
    throw createError({ statusCode: 404, message: 'No member with this username' });
  }

  const conversationId = await sendPrivateMessage(user.id, recipient.id, text);
  return { conversationId };
});
