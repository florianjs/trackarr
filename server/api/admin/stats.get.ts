import { getGlobalStats } from '../../redis/cache';
import { db, schema } from '../../db';
import { sql } from 'drizzle-orm';
import { getTrackerStatus } from '../../tracker/client';
import { requireAdminSession } from '../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdminSession(event);
  // Get total torrents from DB
  const torrentsCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.torrents);
  const totalTorrents = torrentsCountResult[0]?.count || 0;

  // Unique peers and seeders by ip:port (a peer seeding several torrents
  // counts once), counted by the tracker service
  const [globalStats, trackerStatus] = await Promise.all([
    getGlobalStats().catch((err) => {
      console.error('[Stats] Tracker counters unavailable:', err);
      return null;
    }),
    getTrackerStatus(),
  ]);
  const totalPeers = globalStats?.uniquePeers ?? 0;
  const totalSeeders = globalStats?.uniqueSeeders ?? 0;

  // The tracker service only speaks HTTP (UDP/WebSocket were never enabled)
  const protocols = { http: trackerStatus !== null, udp: false, ws: false };

  return {
    status: trackerStatus ? 'running' : 'stopped',
    cached: {
      torrents: totalTorrents,
      peers: totalPeers,
      seeders: totalSeeders,
      updatedAt: globalStats?.updatedAt ?? 0,
    },
    live: {
      torrents: totalTorrents,
      peers: totalPeers,
    },
    protocols,
  };
});
