import { z } from 'zod';
import { parseBodyOrThrow, requireConversation, sendPrivateMessage } from '../../utils/messages';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';
import { validateBody } from '../../utils/schemas';

const replySchema = z.object({ body: z.string().max(10000) });

/**
 * POST /api/messages/:id
 * Reply in a conversation
 */
export default defineEventHandler(async (event) => {
  const { user, otherUserId } = await requireConversation(event);
  await rateLimit(event, RATE_LIMITS.mutation);
  const { body } = await validateBody(event, replySchema);

  if (!otherUserId) {
    throw createError({ statusCode: 410, message: 'This member no longer exists' });
  }

  await sendPrivateMessage(user.id, otherUserId, parseBodyOrThrow(body));
  return { success: true };
});
