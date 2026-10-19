/**
 * Debug endpoint to check tracker status and configuration
 * Usage: GET /api/admin/debug/tracker-status
 */
import { redis } from '../../../redis/client';
import { getGlobalStats } from '../../../redis/cache';
import { getTrackerStatus } from '../../../tracker/client';

export default defineEventHandler(async (event) => {
  // Admin only
  const { user } = await requireAuthSession(event);
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

  // Tracker service (private API)
  const trackerStatus = await getTrackerStatus();

  // Counters it publishes to Redis
  let globalStats = null;
  try {
    globalStats = await getGlobalStats();
  } catch (err) {
    globalStats = { error: (err as Error).message };
  }

  return {
    timestamp: new Date().toISOString(),
    redis: {
      status: redisStatus,
      ping: redisPing,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'ot:',
    },
    tracker: {
      status: trackerStatus ? 'running' : 'unreachable',
      internalUrl: process.env.TRACKER_INTERNAL_URL || 'http://localhost:8090',
      httpUrl: process.env.TRACKER_HTTP_URL || 'not set',
      live: trackerStatus,
    },
    cachedGlobalStats: globalStats,
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasIpHashSecret: !!process.env.IP_HASH_SECRET,
      hasTrackerInternalToken: !!(
        process.env.TRACKER_INTERNAL_TOKEN || process.env.TRACKER_INTERNAL_TOKEN_FILE
      ),
    },
  };
});
