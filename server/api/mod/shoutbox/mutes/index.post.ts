import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { uuidSchema, validateBody } from '~~/server/utils/schemas';
import { isStaff, muteEnd, MAX_MUTE_MINUTES } from '~~/server/utils/shoutboxRules';

const muteSchema = z.object({
  userId: uuidSchema,
  minutes: z.number().int().min(1).max(MAX_MUTE_MINUTES),
  reason: z.string().trim().max(200).optional(),
});

/**
 * POST /api/mod/shoutbox/mutes
 * Mute a member in the shoutbox (replaces any current mute)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireModeratorSession(event);
  const body = await validateBody(event, muteSchema);

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, body.userId),
    columns: { id: true, isAdmin: true, isModerator: true },
  });
  if (!target) {
    throw createError({ statusCode: 404, message: 'User not found' });
  }
  if (isStaff(target)) {
    throw createError({ statusCode: 403, message: 'Staff members cannot be muted' });
  }

  const until = muteEnd(body.minutes, new Date());
  const values = { until, reason: body.reason || null, mutedBy: user.id, createdAt: new Date() };
  await db
    .insert(schema.shoutMutes)
    .values({ userId: target.id, ...values })
    .onConflictDoUpdate({ target: schema.shoutMutes.userId, set: values });

  return { userId: target.id, until };
});
