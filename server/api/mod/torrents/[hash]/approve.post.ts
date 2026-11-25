import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { creditUploadBonus } from '~~/server/utils/bonus';
import { eq } from 'drizzle-orm';
import { invalidateTrackerTorrents } from '~~/server/tracker/client';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const hash = getRouterParam(event, 'hash');

  if (!hash) {
    throw createError({
      statusCode: 400,
      message: 'Torrent hash is required',
    });
  }

  // Approve and pay the upload bonus together: if the credit fails, the
  // torrent stays pending and the approval can be retried
  const approvedTorrent = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.torrents)
      .set({ isApproved: true })
      .where(eq(schema.torrents.infoHash, hash.toLowerCase()))
      .returning({
        id: schema.torrents.id,
        infoHash: schema.torrents.infoHash,
        name: schema.torrents.name,
        isApproved: schema.torrents.isApproved,
        uploaderId: schema.torrents.uploaderId,
      });
    if (row) await creditUploadBonus(tx, row);
    return row;
  });

  if (!approvedTorrent) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  // Tracker caches the row for a few seconds
  invalidateTrackerTorrents();

  return {
    success: true,
    message: 'Torrent approved',
    torrent: approvedTorrent,
  };
});
