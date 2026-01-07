import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const hash = getRouterParam(event, 'hash');
  const body = await readBody(event);

  if (!hash) {
    throw createError({
      statusCode: 400,
      message: 'Torrent hash is required',
    });
  }

  // Find and delete the torrent
  const [deletedTorrent] = await db
    .delete(schema.torrents)
    .where(eq(schema.torrents.infoHash, hash.toLowerCase()))
    .returning();

  if (!deletedTorrent) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  // Also delete associated stats
  await db
    .delete(schema.torrentStats)
    .where(eq(schema.torrentStats.infoHash, hash.toLowerCase()));

  return {
    success: true,
    message: 'Torrent rejected and deleted',
    reason: body?.reason || 'No reason provided',
  };
});
