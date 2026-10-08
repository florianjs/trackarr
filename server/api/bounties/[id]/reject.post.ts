import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { requireBonusEnabled } from '../../../utils/bonus';
import { loadBountyFor, stateChanged } from '../../../utils/bounties';

/**
 * POST /api/bounties/:id/reject
 * Requester or staff refuses the proposed torrent; the bounty reopens
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty } = await loadBountyFor(event, 'reject');

  const updated = await db
    .update(schema.bounties)
    .set({ status: 'open', filledTorrentId: null, filledById: null, claimedAt: null })
    .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, 'claimed')))
    .returning({ id: schema.bounties.id });
  if (updated.length === 0) stateChanged();

  return { success: true };
});
