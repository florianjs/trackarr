import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { and, eq } from 'drizzle-orm';

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

  // Only pending torrents can be rejected: approved ones go through delete
  const [deletedTorrent] = await db
    .delete(schema.torrents)
    .where(
      and(
        eq(schema.torrents.infoHash, hash.toLowerCase()),
        eq(schema.torrents.isApproved, false)
      )
    )
    .returning({ id: schema.torrents.id });

  if (!deletedTorrent) {
    throw createError({
      statusCode: 404,
      message: 'Pending torrent not found',
    });
  }

  // Also delete associated stats
  await db
    .delete(schema.torrentStats)
    .where(eq(schema.torrentStats.infoHash, hash.toLowerCase()));

  return {
    success: true,
    message: 'Torrent rejected and deleted',
    reason:
      typeof body?.reason === 'string' && body.reason
        ? body.reason.slice(0, 500)
        : 'No reason provided',
  };
});
