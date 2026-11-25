import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../../db';
import { requireModeratorSession } from '../../utils/adminAuth';
import { requireBonusEnabled } from '../../utils/bonus';
import { refundContributions } from '../../utils/bounties';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';
import { validateBody } from '../../utils/schemas';
import { bountyBulkSchema } from '../../../shared/utils/bulk';
import { canBountyAction } from '../../../shared/utils/bounties';

/**
 * POST /api/bounties/bulk
 * Cancel (refund) or delete a selection of bounties at once (staff). Each
 * bounty gets its own transaction, so one changed meanwhile is skipped
 * instead of failing the whole batch.
 */
export default defineEventHandler(async (event) => {
  await rateLimit(event, RATE_LIMITS.mutation);
  const { user } = await requireModeratorSession(event);
  const body = await validateBody(event, bountyBulkSchema);
  if (body.action === 'cancel') await requireBonusEnabled();

  const actor = { userId: user.id, isStaff: true };
  const bounties = await db
    .select({ id: schema.bounties.id, title: schema.bounties.title, status: schema.bounties.status, requesterId: schema.bounties.requesterId })
    .from(schema.bounties)
    .where(inArray(schema.bounties.id, body.ids));

  let count = 0;
  for (const bounty of bounties) {
    if (!canBountyAction(bounty, body.action, actor)) continue;

    const done = await db.transaction(async (tx) => {
      // Lock in the state we checked: a fill accepted meanwhile pays out first
      const [locked] = await tx
        .select({ id: schema.bounties.id })
        .from(schema.bounties)
        .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, bounty.status)))
        .for('update');
      if (!locked) return false;

      // Points held by an open or claimed bounty go back; a filled one paid out
      const holdsPoints = bounty.status === 'open' || bounty.status === 'claimed';
      if (holdsPoints) await refundContributions(tx, bounty);

      if (body.action === 'delete') {
        await tx.delete(schema.bounties).where(eq(schema.bounties.id, bounty.id));
      } else {
        await tx
          .update(schema.bounties)
          .set({ status: 'cancelled', totalPoints: 0, filledTorrentId: null, filledById: null, claimedAt: null })
          .where(eq(schema.bounties.id, bounty.id));
      }
      return true;
    });
    if (done) count++;
  }

  return { action: body.action, count, skipped: body.ids.length - count };
});
