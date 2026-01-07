/**
 * DELETE /api/torrents/:hash
 * Delete a torrent from the tracker
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { torrents } from '../../db/schema';
import { redis } from '../../redis/client';
import { requireAdminSession } from '../../utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';

export default defineEventHandler(async (event) => {
  // Rate limit admin endpoints
  rateLimit(event, RATE_LIMITS.admin);

  // Require admin authentication
  await requireAdminSession(event);

  const hash = getRouterParam(event, 'hash');

  if (!hash) {
    throw createError({
      statusCode: 400,
      message: 'Missing info hash',
    });
  }

  const infoHash = hash.toLowerCase();

  // Check if torrent exists
  const existing = await db.query.torrents.findFirst({
    where: eq(torrents.infoHash, infoHash),
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  // Delete from PostgreSQL
  await db.delete(torrents).where(eq(torrents.infoHash, infoHash));

  // Delete from Redis cache
  try {
    await redis.del(`peers:${infoHash}`);
    await redis.del(`stats:${infoHash}`);
  } catch {
    // Redis errors are non-fatal
  }

  return {
    success: true,
    message: 'Torrent deleted',
    data: {
      infoHash,
      name: existing.name,
    },
  };
});
