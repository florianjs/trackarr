import { and, desc, eq, gt } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { requireModerationTarget } from '~~/server/utils/userModeration';
import { isDeletedUsername } from '~~/shared/utils/userModeration';

/**
 * GET /api/mod/users/:id
 * Account state shown in the moderation panel of a profile, with what the
 * viewing staff member may do. Raw IP and bonus are admin only.
 */
export default defineEventHandler(async (event) => {
  const { actor, target, rights } = await requireModerationTarget(event, 'view');

  const [mute] = await db
    .select({ until: schema.shoutMutes.until, reason: schema.shoutMutes.reason })
    .from(schema.shoutMutes)
    .where(and(eq(schema.shoutMutes.userId, target.id), gt(schema.shoutMutes.until, new Date())))
    .limit(1);

  const [appeal] = target.ipHold
    ? await db
        .select({ message: schema.ipAppeals.message, createdAt: schema.ipAppeals.createdAt })
        .from(schema.ipAppeals)
        .where(and(eq(schema.ipAppeals.userId, target.id), eq(schema.ipAppeals.status, 'pending')))
        .orderBy(desc(schema.ipAppeals.createdAt))
        .limit(1)
    : [];

  return {
    id: target.id,
    username: target.username,
    isAdmin: target.isAdmin,
    isModerator: target.isModerator,
    isBanned: target.isBanned,
    isDeleted: isDeletedUsername(target.username) && !target.authVerifier,
    paymentPending: target.paymentPending,
    ipHold: target.ipHold,
    ipExempt: target.ipExempt,
    roleId: target.roleId,
    hasAvatar: !!target.avatarUrl,
    mute: mute ?? null,
    appeal: appeal ?? null,
    lastIp: actor.isAdmin ? target.lastIp : null,
    bonusPoints: actor.isAdmin ? target.bonusPoints : null,
    invitesRemaining: actor.isAdmin ? target.invitesRemaining : null,
    rights,
  };
});
