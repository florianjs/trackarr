import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const hash = getRouterParam(event, 'hash');

  if (!hash) {
    throw createError({
      statusCode: 400,
      message: 'Torrent hash is required',
    });
  }

  // Approve the torrent
  const [approvedTorrent] = await db
    .update(schema.torrents)
    .set({ isApproved: true })
    .where(eq(schema.torrents.infoHash, hash.toLowerCase()))
    .returning();

  if (!approvedTorrent) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  return {
    success: true,
    message: 'Torrent approved',
    torrent: approvedTorrent,
  };
});
