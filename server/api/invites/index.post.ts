import { db, schema } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'crypto';
import { isInviteEnabled } from '../../utils/settings';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  rateLimit(event, RATE_LIMITS.mutation);

  // Check if invites are enabled
  const enabled = await isInviteEnabled();
  if (!enabled) {
    throw createError({
      statusCode: 403,
      message: 'Invitation system is currently disabled',
    });
  }

  // Check if user has invites remaining
  const userData = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { invitesRemaining: true },
  });

  if (!userData || userData.invitesRemaining <= 0) {
    throw createError({
      statusCode: 403,
      message: 'No invites remaining',
    });
  }

  // Generate unique invite code
  const code = randomBytes(16).toString('hex').toUpperCase();

  // Create invitation and decrement user's remaining invites
  const [invite] = await Promise.all([
    db
      .insert(schema.invitations)
      .values({
        id: randomUUID(),
        code,
        createdBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning(),
    db
      .update(schema.users)
      .set({
        invitesRemaining: sql`${schema.users.invitesRemaining} - 1`,
      })
      .where(eq(schema.users.id, user.id)),
  ]);

  return {
    success: true,
    invite: invite[0],
  };
});
