/**
 * Site-wide numbers shown on the home page (members, live peers, seeded
 * torrents, data shared). Swarm counts need a scan of every peer hash, so
 * the result is cached in Redis and shared by every app node.
 */

import { sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { redis } from '../redis/client';
import { countPeers } from '../redis/peerCount';

const CACHE_KEY = 'stats:public';
const CACHE_TTL_SEC = 300;
const SCAN_BATCH = 500;

export interface PublicStats {
  members: number;
  /** null when Redis cannot be read */
  activePeers: number | null;
  seededTorrents: number | null;
  /** Total uploaded by all members, in bytes */
  shared: number;
  updatedAt: string;
}

/** Live peers and torrents with at least one seeder, from raw peer hashes */
export function aggregateSwarms(swarms: Array<Record<string, string>>, now: number) {
  let activePeers = 0;
  let seededTorrents = 0;
  for (const peers of swarms) {
    const { seeders, leechers } = countPeers(peers, now);
    activePeers += seeders + leechers;
    if (seeders > 0) seededTorrents++;
  }
  return { activePeers, seededTorrents };
}

async function scanSwarms() {
  // SCAN returns keys with the client prefix, which commands add again
  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';
  const now = Date.now();
  let activePeers = 0;
  let seededTorrents = 0;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${keyPrefix}peers:*`, 'COUNT', SCAN_BATCH);
    cursor = next;
    if (keys.length === 0) continue;
    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.hgetall(key.slice(keyPrefix.length));
    const replies = (await pipeline.exec()) ?? [];
    const swarms = replies
      .filter(([err]) => !err)
      .map(([, value]) => (value as Record<string, string> | null) ?? {});
    const batch = aggregateSwarms(swarms, now);
    activePeers += batch.activePeers;
    seededTorrents += batch.seededTorrents;
  } while (cursor !== '0');
  return { activePeers, seededTorrents };
}

async function computePublicStats(): Promise<PublicStats> {
  const [[totals], swarms] = await Promise.all([
    db
      .select({
        members: sql<number>`count(*)::int`,
        shared: sql<string>`coalesce(sum(${schema.users.uploaded}), 0)::text`,
      })
      .from(schema.users),
    scanSwarms().catch((err) => {
      console.error('[Stats] Swarm scan failed:', err);
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
