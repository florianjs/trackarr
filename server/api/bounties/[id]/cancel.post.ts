import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { requireBonusEnabled } from '../../../utils/bonus';
import { loadBountyFor, refundContributions, stateChanged } from '../../../utils/bounties';

/**
 * POST /api/bounties/:id/cancel
 * Requester or staff closes an open bounty (staff also a claimed one); every
 * contribution is refunded
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty } = await loadBountyFor(event, 'cancel');

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.bounties)
      .set({ status: 'cancelled', totalPoints: 0, filledTorrentId: null, filledById: null, claimedAt: null })
      .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, bounty.status), inArray(schema.bounties.status, ['open', 'claimed'])))
      .returning({ id: schema.bounties.id });
    if (updated.length === 0) stateChanged();

    await refundContributions(tx, bounty);
  });

  return { success: true };
});
