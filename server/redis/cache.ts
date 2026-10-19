import { redis } from './client';
import { TtlCache } from '../utils/ttlCache';
import { trackerInternal } from '../tracker/client';

// Published by the tracker service (tracker/src/publish.rs)
const SWARMS_KEY = 'tracker:swarms'; // info hash → "seeders:leechers"
const STATS_KEY = (infoHash: string) => `stats:${infoHash}`; // completed
const GLOBAL_STATS_KEY = 'tracker:stats';

// ============================================================================
// Peers (live in the tracker's memory)
// ============================================================================
export interface SwarmPeer {
  ipHash: string; // Hashed IP: raw IPs never leave the tracker
  port: number;
  isSeeder: boolean;
  uploaded: number;
  downloaded: number;
  left: number | null;
  updatedAt: number;
}

/**
 * Get all peers for a torrent (empty when the tracker cannot be reached)
 */
export async function getPeers(infoHash: string): Promise<SwarmPeer[]> {
  const swarm = await trackerInternal<{ peers: SwarmPeer[] }>(
    `/internal/swarms/${infoHash}`
  );
  return swarm?.peers ?? [];
}

// ============================================================================
// Stats Operations
// ============================================================================
export interface TorrentStats {
  seeders: number;
  leechers: number;
  completed: number;
}

/** Parse a "seeders:leechers" counter; missing means an empty swarm */
export function parseSwarmCounts(value: string | null | undefined): {
  seeders: number;
  leechers: number;
} {
  const [seeders, leechers] = (value ?? '').split(':').map((n) => parseInt(n, 10));
  return {
    seeders: Number.isFinite(seeders) ? seeders! : 0,
    leechers: Number.isFinite(leechers) ? leechers! : 0,
  };
}

// The tracker publishes changed counts every few seconds: Lists, Torznab and
// RSS asking for the same torrents share one read for that long
const STATS_CACHE_MS = 5_000;
const statsCache = new TtlCache<string, TorrentStats>(STATS_CACHE_MS, 100_000);

/**
 * Get stats for several torrents in one Redis round trip (cached per torrent)
 */
export async function getStatsMany(
  infoHashes: string[]
): Promise<Map<string, TorrentStats>> {
  const result = new Map<string, TorrentStats>();
  const missingSet = new Set<string>();

  for (const hash of infoHashes) {
    const cached = statsCache.get(hash);
    if (cached) result.set(hash, cached);
    else missingSet.add(hash);
  }
  const missing = [...missingSet];

  if (missing.length > 0) {
    const pipeline = redis.pipeline();
    pipeline.hmget(SWARMS_KEY, ...missing);
    for (const hash of missing) pipeline.hget(STATS_KEY(hash), 'completed');
    const replies = (await pipeline.exec()) ?? [];

    // Each reply is [error, value]: never cache counts built from a failure
    const failure = replies.find(([err]) => err)?.[0];
    if (failure || replies.length !== missing.length + 1) {
      throw failure ?? new Error('Incomplete Redis pipeline reply');
    }

    const counts = (replies[0]![1] as Array<string | null>) ?? [];
    missing.forEach((hash, i) => {
      const completedRaw = replies[i + 1]![1] as string | null;
      const stats = {
        ...parseSwarmCounts(counts[i]),
        completed: parseInt(completedRaw || '0', 10),
      };
      statsCache.set(hash, stats);
      result.set(hash, stats);
    });
  }

  return result;
}

/**
 * Get stats for a torrent (cached for a few seconds)
 */
export async function getStats(infoHash: string): Promise<TorrentStats> {
  const stats = await getStatsMany([infoHash]);
  return stats.get(infoHash)!;
}

// ============================================================================
// Global Stats
// ============================================================================
export interface GlobalStats {
  torrents: number;
  /** Peer entries: a client in 10 swarms counts 10 times */
  peers: number;
  seeders: number;
  leechers: number;
  /** Torrents with at least one seeder */
  seededTorrents: number;
  /** Distinct ip:port */
  uniquePeers: number;
  uniqueSeeders: number;
  /** 0 when the tracker never published */
  updatedAt: number;
}

export function parseGlobalStats(data: Record<string, string>): GlobalStats {
  const n = (key: string) => parseInt(data[key] || '0', 10) || 0;
  return {
    torrents: n('torrents'),
    peers: n('peers'),
    seeders: n('seeders'),
    leechers: n('leechers'),
    seededTorrents: n('seededTorrents'),
    uniquePeers: n('uniquePeers'),
    uniqueSeeders: n('uniqueSeeders'),
    updatedAt: n('updatedAt'),
  };
}

/** Site-wide counters, refreshed by the tracker every minute */
export async function getGlobalStats(): Promise<GlobalStats> {
  return parseGlobalStats(await redis.hgetall(GLOBAL_STATS_KEY));
}
