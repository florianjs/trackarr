import { db, schema } from '../db';
import { sql } from 'drizzle-orm';
import { redis } from '../redis/client';
import { v4 as uuidv4 } from 'uuid';

export default defineNitroPlugin((nitroApp) => {
  // Run every hour by default, or use env var (in ms)
  const INTERVAL = parseInt(
    process.env.STATS_COLLECTION_INTERVAL || '3600000',
    10
  );

  console.log(`[Stats Collector] Initialized with interval: ${INTERVAL}ms`);

  const collectStats = async () => {
    console.log('[Stats Collector] Starting stats collection...');
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

      // 3. Peers & Seeders Count (from Redis) - count unique peers by ip:port
      // Note: ioredis with keyPrefix - SCAN returns full keys with prefix,
      // but we need to strip the prefix before passing to other commands
      const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';
      const uniquePeers = new Set<string>();
      const uniqueSeeders = new Set<string>();
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${keyPrefix}peers:*`,
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
              const peerKey = `${peer.ip}:${peer.port}`;
              uniquePeers.add(peerKey);
              if (peer.isSeeder) uniqueSeeders.add(peerKey);
            } catch (e) {}
          }
        }
      } while (cursor !== '0');
      const peersCount = uniquePeers.size;
      const seedersCount = uniqueSeeders.size;

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

      console.log(
        `[Stats Collector] Stats collected successfully. Peers: ${peersCount}, Seeders: ${seedersCount}`
      );
    } catch (err) {
      console.error('[Stats Collector] Failed to collect stats:', err);
    }
  };

  // Initial collection after a short delay to ensure DB/Redis are ready
  setTimeout(collectStats, 10000);

  // Schedule periodic collection
  setInterval(collectStats, INTERVAL);
});
