/**
 * Debug endpoint to check tracker status and configuration
 * Usage: GET /api/admin/debug/tracker-status
 */
import { redis } from '../../../redis/client';
import { getGlobalStats } from '../../../redis/cache';

export default defineEventHandler(async (event) => {
  // Admin only
  const { user } = await requireUserSession(event);
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin only' });
  }

  // Check Redis connection
  let redisStatus = 'unknown';
  let redisPing = '';
  try {
    redisPing = await redis.ping();
    redisStatus = redisPing === 'PONG' ? 'connected' : 'error';
  } catch (err) {
    redisStatus = 'disconnected';
    redisPing = (err as Error).message;
  }

  // Check tracker
  let trackerStatus = 'unknown';
  let trackerProtocols: Record<string, boolean> = {};
  try {
    const { getTracker } = await import('../../../tracker');
    const tracker = getTracker();
    if (tracker) {
      trackerStatus = 'running';
      trackerProtocols = {
        http: !!tracker.http,
        udp: !!tracker.udp,
        ws: !!tracker.ws,
      };
    } else {
      trackerStatus = 'not initialized';
    }
  } catch (err) {
    trackerStatus = 'error: ' + (err as Error).message;
  }

  // Get global stats from cache
  let globalStats = null;
  try {
    globalStats = await getGlobalStats();
  } catch (err) {
    globalStats = { error: (err as Error).message };
  }

  // Count peer keys manually
  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';
  let peerKeyCount = 0;
  let totalPeersInRedis = 0;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'peers:*',
        'COUNT',
        100
      );
      cursor = nextCursor;
      for (const fullKey of keys) {
        peerKeyCount++;
        const key = fullKey.startsWith(keyPrefix)
          ? fullKey.slice(keyPrefix.length)
          : fullKey;
        const count = await redis.hlen(key);
        totalPeersInRedis += count;
      }
    } while (cursor !== '0');
  } catch (err) {
    peerKeyCount = -1;
  }

  return {
    timestamp: new Date().toISOString(),
    redis: {
      status: redisStatus,
      ping: redisPing,
      keyPrefix,
    },
    tracker: {
      status: trackerStatus,
      protocols: trackerProtocols,
      httpUrl: process.env.TRACKER_HTTP_URL || 'not set',
    },
    peers: {
      keyCount: peerKeyCount,
      totalPeers: totalPeersInRedis,
    },
    cachedGlobalStats: globalStats,
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasIpHashSecret: !!process.env.IP_HASH_SECRET,
      redisHost: process.env.REDIS_HOST || 'not set',
      redisPort: process.env.REDIS_PORT || 'not set',
    },
  };
});
