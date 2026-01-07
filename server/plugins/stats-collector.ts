import { db, schema } from '../db';
import { sql } from 'drizzle-orm';
import { redis } from '../redis/client';
import { v4 as uuidv4 } from 'uuid';

export default defineNitroPlugin((nitroApp) => {
  // Run every hour
  const INTERVAL = 60 * 60 * 1000;

  const collectStats = async () => {
    try {
      // 1. Users Count
      const usersCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.users);
      const usersCount = usersCountResult[0]?.count || 0;

      // 2. Torrents Count
      const torrentsCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.torrents);
      const torrentsCount = torrentsCountResult[0]?.count || 0;

      // 3. Peers & Seeders Count (from Redis)
      // Note: ioredis with keyPrefix - SCAN returns full keys with prefix,
      // but we need to strip the prefix before passing to other commands
      const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';
      let peersCount = 0;
      let seedersCount = 0;
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
          // Strip the prefix from the key returned by SCAN to avoid double-prefixing
          const key = fullKey.startsWith(keyPrefix)
            ? fullKey.slice(keyPrefix.length)
            : fullKey;
          const peersData = await redis.hgetall(key);
          for (const json of Object.values(peersData)) {
            try {
              const peer = JSON.parse(json as string);
              peersCount++;
              if (peer.isSeeder) seedersCount++;
            } catch (e) {}
          }
        }
      } while (cursor !== '0');

      // 4. Redis Memory Usage
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const redisMemoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      // 5. DB Size
      const dbSizeResult = await db.execute(
        sql`SELECT pg_database_size(current_database())::bigint`
      );
      const dbSize = Number(dbSizeResult[0]?.pg_database_size) || 0;

      // Save to DB
      await db.insert(schema.siteStats).values({
        id: uuidv4(),
        usersCount,
        torrentsCount,
        peersCount,
        seedersCount,
        redisMemoryUsage,
        dbSize,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('[Stats Collector] Failed to collect stats:', err);
    }
  };

  // Initial collection after a short delay to ensure DB/Redis are ready
  setTimeout(collectStats, 10000);

  // Schedule periodic collection
  setInterval(collectStats, INTERVAL);
});
