import { db, schema } from '../../db';
import { and, eq, gt, sql } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'crypto';
import { isInviteEnabled } from '../../utils/settings';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  await rateLimit(event, RATE_LIMITS.mutation);

  // Check if invites are enabled
  const enabled = await isInviteEnabled();
  if (!enabled) {
    throw createError({
      statusCode: 403,
      message: 'Invitation system is currently disabled',
    });
  }

  // Generate unique invite code
  const code = randomBytes(16).toString('hex').toUpperCase();

  // Decrement only if an invite is left, in the same transaction as the
  // insert: parallel requests cannot create more codes than allowed.
  const invite = await db.transaction(async (tx) => {
    const decremented = await tx
      .update(schema.users)
      .set({
        invitesRemaining: sql`${schema.users.invitesRemaining} - 1`,
      })
      .where(
        and(eq(schema.users.id, user.id), gt(schema.users.invitesRemaining, 0))
      )
      .returning({ id: schema.users.id });

    if (decremented.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'No invites remaining',
      });
    }

    return tx
      .insert(schema.invitations)
      .values({
        id: randomUUID(),
        code,
        createdBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();
  });

  return {
    success: true,
    invite: invite[0],
  };
});
