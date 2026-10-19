import { db, schema } from '../db';
import { sql } from 'drizzle-orm';
import { redis } from '../redis/client';
import { claim } from '../redis/claim';
import { getGlobalStats } from '../redis/cache';
import { v4 as uuidv4 } from 'uuid';

export default defineNitroPlugin((nitroApp) => {
  // Run every hour by default, or use env var (in ms)
  const INTERVAL = parseInt(
    process.env.STATS_COLLECTION_INTERVAL || '3600000',
    10
  );

  console.log(`[Stats Collector] Initialized with interval: ${INTERVAL}ms`);

  const collectStats = async () => {
    try {
      // With several app nodes, only the first to claim this interval collects.
      // The margin absorbs timer drift between nodes.
      if (!(await claim(redis, 'job:stats-collector', INTERVAL * 0.9))) return;

      console.log('[Stats Collector] Starting stats collection...');
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

      // 3. Peers & Seeders Count: unique ip:port, published by the tracker
      const trackerStats = await getGlobalStats();
      const peersCount = trackerStats.uniquePeers;
      const seedersCount = trackerStats.uniqueSeeders;

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
