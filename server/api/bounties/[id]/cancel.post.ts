import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { changeBonusPoints, requireBonusEnabled } from '../../../utils/bonus';
import { loadBountyFor, stateChanged } from '../../../utils/bounties';

/**
 * POST /api/bounties/:id/cancel
 * Requester or staff closes an open bounty; every contribution is refunded
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty } = await loadBountyFor(event, 'cancel');

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.bounties)
      .set({ status: 'cancelled', totalPoints: 0 })
      .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, 'open')))
      .returning({ id: schema.bounties.id });
    if (updated.length === 0) stateChanged();

    const contributions = await tx
      .select({ userId: schema.bountyContributions.userId, amount: schema.bountyContributions.amount })
      .from(schema.bountyContributions)
      .where(eq(schema.bountyContributions.bountyId, bounty.id));

    for (const c of contributions) {
      await changeBonusPoints(tx, {
        userId: c.userId,
        amount: c.amount,
        type: 'bounty_refund',
        description: bounty.title,
        refId: bounty.id,
      });
    }
  });

  return { success: true };
});
