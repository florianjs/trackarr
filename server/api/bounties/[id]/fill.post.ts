import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../../db';
import { requireBonusEnabled } from '../../../utils/bonus';
import { loadBountyFor, stateChanged } from '../../../utils/bounties';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import { infoHashSchema, validateBody } from '../../../utils/schemas';

const fillSchema = z.object({ infoHash: infoHashSchema });

/**
 * POST /api/bounties/:id/fill
 * Propose an approved torrent as the answer. The torrent's uploader gets the
 * reward once the requester (or staff) accepts.
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty } = await loadBountyFor(event, 'fill');
  await rateLimit(event, RATE_LIMITS.mutation);
  const { infoHash } = await validateBody(event, fillSchema);

  const torrent = await db.query.torrents.findFirst({
    where: eq(schema.torrents.infoHash, infoHash.toLowerCase()),
    columns: { id: true, uploaderId: true, isApproved: true, isActive: true },
  });
  if (!torrent || !torrent.isApproved || !torrent.isActive || !torrent.uploaderId) {
    throw createError({ statusCode: 400, message: 'Torrent not found or not approved' });
  }
  // Otherwise the requester could get their own points back as a "reward"
  if (torrent.uploaderId === bounty.requesterId) {
    throw createError({
      statusCode: 400,
      message: 'The requester cannot fill their own bounty',
    });
  }

  const updated = await db
    .update(schema.bounties)
    .set({
      status: 'claimed',
      filledTorrentId: torrent.id,
      filledById: torrent.uploaderId,
      claimedAt: new Date(),
    })
    .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, 'open')))
    .returning({ id: schema.bounties.id });
  if (updated.length === 0) stateChanged();

  return { success: true };
});
