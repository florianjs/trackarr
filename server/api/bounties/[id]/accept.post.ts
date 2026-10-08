import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { changeBonusPoints, requireBonusEnabled } from '../../../utils/bonus';
import { loadBountyFor, stateChanged } from '../../../utils/bounties';

/**
 * POST /api/bounties/:id/accept
 * Requester or staff confirms the proposed torrent; the pot goes to its uploader
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty } = await loadBountyFor(event, 'accept');

  await db.transaction(async (tx) => {
    const [filled] = await tx
      .update(schema.bounties)
      .set({ status: 'filled', filledAt: new Date() })
      .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, 'claimed')))
      .returning({
        filledById: schema.bounties.filledById,
        totalPoints: schema.bounties.totalPoints,
      });
    if (!filled) stateChanged();

    if (filled.filledById && filled.totalPoints > 0) {
      await changeBonusPoints(tx, {
        userId: filled.filledById,
        amount: filled.totalPoints,
        type: 'bounty_reward',
        description: bounty.title,
        refId: bounty.id,
      });
    }
  });

  return { success: true };
});
