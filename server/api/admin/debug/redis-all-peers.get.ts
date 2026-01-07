/**
 * Debug endpoint to list all peer keys in Redis
 * Usage: GET /api/admin/debug/redis-all-peers
 * Useful for diagnosing if peers are being stored at all
 */
import { redis } from '../../../redis/client';

export default defineEventHandler(async (event) => {
  // Admin only
  const { user } = await requireUserSession(event);
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin only' });
  }

  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';
  const keys: string[] = [];
  const peerCounts: Record<string, number> = {};
  let cursor = '0';

  try {
    // Scan for all peer keys
    do {
      const [nextCursor, foundKeys] = await redis.scan(
        cursor,
        'MATCH',
        'peers:*',
        'COUNT',
        100
      );
      cursor = nextCursor;

      for (const fullKey of foundKeys) {
        // Strip prefix from the key returned by SCAN
        const key = fullKey.startsWith(keyPrefix)
          ? fullKey.slice(keyPrefix.length)
          : fullKey;
        keys.push(key);

        // Get count of peers in this key
        const count = await redis.hlen(key);
        peerCounts[key] = count;
      }
    } while (cursor !== '0');
  } catch (err) {
    throw createError({
      statusCode: 500,
      message: `Redis scan failed: ${(err as Error).message}`,
    });
  }

  return {
    redisKeyPrefix: keyPrefix,
    totalKeys: keys.length,
    keys: keys.slice(0, 50), // Limit for safety
    peerCounts,
    note:
      keys.length > 50
        ? `Showing first 50 of ${keys.length} keys`
        : 'Showing all keys',
  };
});
