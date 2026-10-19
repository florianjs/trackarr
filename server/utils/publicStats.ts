/**
 * Site-wide numbers shown on the home page (members, live peers, seeded
 * torrents, data shared). Swarm counts come from the tracker service's
 * published counters; the member totals need a full table aggregate, so the
 * result is cached in Redis and shared by every app node.
 */

import { sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { redis } from '../redis/client';
import { getGlobalStats, type GlobalStats } from '../redis/cache';

const CACHE_KEY = 'stats:public';
const CACHE_TTL_SEC = 300;
/** Older counters mean the tracker stopped publishing: do not show them */
const MAX_AGE_MS = 30 * 60 * 1000;

export interface PublicStats {
  members: number;
  /** null when the tracker counters are unavailable */
  activePeers: number | null;
  seededTorrents: number | null;
  /** Total uploaded by all members, in bytes */
  shared: number;
  updatedAt: string;
}

/** Live peers and seeded torrents, or nulls when the counters are missing or stale */
export function swarmNumbers(stats: GlobalStats, now: number) {
  if (stats.updatedAt === 0 || now - stats.updatedAt > MAX_AGE_MS) {
    return { activePeers: null, seededTorrents: null };
  }
  return { activePeers: stats.peers, seededTorrents: stats.seededTorrents };
}

async function computePublicStats(): Promise<PublicStats> {
  const [[totals], swarms] = await Promise.all([
    db
      .select({
        members: sql<number>`count(*)::int`,
        shared: sql<string>`coalesce(sum(${schema.users.uploaded}), 0)::text`,
      })
      .from(schema.users),
    getGlobalStats()
      .then((stats) => swarmNumbers(stats, Date.now()))
      .catch((err) => {
        console.error('[Stats] Tracker counters unavailable:', err);
        return { activePeers: null, seededTorrents: null };
      }),
  ]);
  return {
    members: totals?.members ?? 0,
    activePeers: swarms.activePeers,
    seededTorrents: swarms.seededTorrents,
    // Sum of bigints: read as text, past what an int column holds
    shared: Number(totals?.shared ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

export async function getPublicStats(): Promise<PublicStats> {
  const cached = await redis.get(CACHE_KEY).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached) as PublicStats;
    } catch {
      // Recompute below
    }
  }
  const stats = await computePublicStats();
  // Never cache a result missing the swarm part: retry on the next request
  if (stats.activePeers !== null) {
    await redis.set(CACHE_KEY, JSON.stringify(stats), 'EX', CACHE_TTL_SEC).catch(() => {});
  }
  return stats;
}
