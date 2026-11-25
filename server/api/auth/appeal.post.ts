import { randomUUID } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '~~/server/db';
import { requireAuthSession, type AuthUserState } from '~~/server/utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '~~/server/utils/rateLimit';
import { validateBody } from '~~/server/utils/schemas';
import {
  APPEAL_MAX_LENGTH,
  APPEAL_MIN_LENGTH,
  canFileAppeal,
} from '~~/shared/utils/multiAccount';

const appealSchema = z.object({
  message: z.string().trim().min(APPEAL_MIN_LENGTH).max(APPEAL_MAX_LENGTH),
});

/**
 * POST /api/auth/appeal
 * A held account explains why it shares an IP (family, flatmates…)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event, { allowIpHold: true });
  if (!(event.context.authUser as AuthUserState).ipHold) {
    throw createError({ statusCode: 400, message: 'Your account is not on hold' });
  }
  await rateLimit(event, RATE_LIMITS.mutation);
  const body = await validateBody(event, appealSchema);

  const [latest] = await db
    .select({ status: schema.ipAppeals.status })
    .from(schema.ipAppeals)
    .where(eq(schema.ipAppeals.userId, user.id))
    .orderBy(desc(schema.ipAppeals.createdAt))
    .limit(1);
  if (!canFileAppeal(latest)) {
    throw createError({ statusCode: 409, message: 'An appeal is already waiting for review' });
  }

  const id = randomUUID();
  await db.insert(schema.ipAppeals).values({ id, userId: user.id, message: body.message });
  return { id };
});
