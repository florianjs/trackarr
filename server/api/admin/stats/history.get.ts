import { db, schema } from '../../../db';
import { desc, asc, gte, sql } from 'drizzle-orm';
import { requireAdminSession } from '../../../utils/adminAuth';
import { redis } from '../../../redis/client';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const query = getQuery(event);
  const days = parseInt(query.days as string) || 7;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 1. Get historical stats
  const history = await db
    .select()
    .from(schema.siteStats)
    .where(gte(schema.siteStats.createdAt, startDate))
    .orderBy(asc(schema.siteStats.createdAt));

  // 2. keyPrefix (should match stats-collector)
  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';

  // 3. Get CURRENT live stats to append as the latest data point
  // This ensures the charts show real-time state even if collector hasn't run recently
  try {
    // Users
    const usersCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users);
    const usersCount = usersCountResult[0]?.count || 0;

    // Torrents
    const torrentsCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.torrents);
    const torrentsCount = torrentsCountResult[0]?.count || 0;

    // Redis Memory
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const redisMemoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

    // DB Size
    const dbSizeResult = await db.execute(
      sql`SELECT pg_database_size(current_database())::bigint`
    );
    const dbSize = Number(dbSizeResult[0]?.pg_database_size) || 0;

    // Peers & Seeders (SCAN) - count unique peers by ip:port
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

    // Always append a 'live' data point to show current real-time stats
    // This ensures the chart always reflects the current state
    const livePoint = {
      id: 'live',
      usersCount,
      torrentsCount,
      peersCount,
      seedersCount,
      redisMemoryUsage,
      dbSize,
      createdAt: new Date(),
    } as any;

    // If the last historical point is very recent (< 1 min), replace it with live data
    // Otherwise append as a new point
    const lastPoint = history[history.length - 1];
    const now = Date.now();
    const oneMinute = 60 * 1000;

    if (
      lastPoint &&
      now - new Date(lastPoint.createdAt).getTime() < oneMinute
    ) {
      // Replace the last point with live data
      history[history.length - 1] = {
        ...lastPoint,
        ...livePoint,
        id: lastPoint.id,
      };
    } else {
      history.push(livePoint);
    }
  } catch (err) {
    console.error('[Stats History] Failed to fetch live stats:', err);
  }

  return history;
});
