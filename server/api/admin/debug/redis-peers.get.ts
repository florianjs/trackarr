/**
 * Debug endpoint to check the live swarm of a torrent
 * Usage: GET /api/admin/debug/redis-peers?infoHash=xxx
 * Peers come from the tracker service; counters from what it publishes to Redis
 */
import { getPeers, getStats } from '../../../redis/cache';
import { redis } from '../../../redis/client';

export default defineEventHandler(async (event) => {
  // Admin only
  const { user } = await requireAuthSession(event);
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin only' });
  }

  const query = getQuery(event);
  const infoHash = (query.infoHash as string)?.toLowerCase();

  if (!infoHash || !/^[a-f0-9]{40}$/.test(infoHash)) {
    throw createError({ statusCode: 400, message: 'Invalid infoHash' });
  }

  const [stats, peers, rawCounts, rawStats] = await Promise.all([
    getStats(infoHash),
    getPeers(infoHash),
    redis.hget('tracker:swarms', infoHash),
    redis.hgetall(`stats:${infoHash}`),
  ]);

  return {
    infoHash,
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'ot:',
    stats,
    peersCount: peers.length,
    peers: peers.map((p) => ({
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
      swarmCounts: rawCounts,
      rawStats,
    },
  };
});
