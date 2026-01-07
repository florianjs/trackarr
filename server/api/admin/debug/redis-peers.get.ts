/**
 * Debug endpoint to check Redis peer data for a torrent
 * Usage: GET /api/admin/debug/redis-peers?infoHash=xxx
 */
import { getPeers, getStats } from '../../../redis/cache';
import { redis } from '../../../redis/client';

export default defineEventHandler(async (event) => {
  // Admin only
  const { user } = await requireUserSession(event);
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin only' });
  }

  const query = getQuery(event);
  const infoHash = (query.infoHash as string)?.toLowerCase();

  if (!infoHash || !/^[a-f0-9]{40}$/.test(infoHash)) {
    throw createError({ statusCode: 400, message: 'Invalid infoHash' });
  }

  // Get data from Redis cache functions
  const [stats, peers] = await Promise.all([
    getStats(infoHash),
    getPeers(infoHash),
  ]);

  // Also get raw Redis data for debugging
  const peerKey = `peers:${infoHash}`;
  const statsKey = `stats:${infoHash}`;

  const rawPeers = await redis.hgetall(peerKey);
  const rawStats = await redis.hgetall(statsKey);
  const peerTTL = await redis.ttl(peerKey);

  return {
    infoHash,
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'ot:',
    stats,
    peersCount: peers.length,
    peers: peers.map((p) => ({
      peerId: p.peerId.slice(0, 16) + '...',
      ipHash: p.ipHash,
      port: p.port,
      isSeeder: p.isSeeder,
      left: p.left,
      uploaded: p.uploaded,
      downloaded: p.downloaded,
      updatedAt: new Date(p.updatedAt).toISOString(),
      ageSeconds: Math.floor((Date.now() - p.updatedAt) / 1000),
    })),
    rawRedis: {
      peerKey,
      statsKey,
      peerTTL,
      rawPeersCount: Object.keys(rawPeers).length,
      rawStats,
    },
  };
});
