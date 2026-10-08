import { redis } from './client';
import { hashIP } from '../utils/crypto';
import { TtlCache } from '../utils/ttlCache';

// Keys
const PEER_KEY = (infoHash: string) => `peers:${infoHash}`;
const STATS_KEY = (infoHash: string) => `stats:${infoHash}`;
const GLOBAL_STATS_KEY = 'tracker:stats';

// TTL: 30 minutes for peers (standard announce interval is 30 min)
const PEER_TTL = 1800;

// ============================================================================
// Peer Types
// ============================================================================
export interface PeerData {
  peerId: string;
  owner?: string; // Hash of the announcing user's passkey
  ip: string; // Raw IP - needed for tracker peer exchange
  ipHash: string; // Hashed IP - for logging/display
  port: number;
  uploaded: number;
  downloaded: number;
  left: number;
  isSeeder: boolean;
  updatedAt: number;
}

// ============================================================================
// Peer Operations
// ============================================================================

/**
 * Add or update a peer in the swarm
 */
export async function setPeer(
  infoHash: string,
  peerId: string,
  data: Omit<PeerData, 'peerId' | 'ipHash' | 'updatedAt'>
): Promise<void> {
  const key = PEER_KEY(infoHash);
  const peerData: PeerData = {
    peerId,
    ...data,
    ipHash: hashIP(data.ip), // Store hashed version for display/logging
    updatedAt: Date.now(),
  };

  await redis.hset(key, peerId, JSON.stringify(peerData));
  await redis.expire(key, PEER_TTL);
}

/**
 * Get a single peer from the swarm
 */
export async function getPeer(
  infoHash: string,
  peerId: string
): Promise<PeerData | null> {
  const key = PEER_KEY(infoHash);
  const data = await redis.hget(key, peerId);
  if (!data) return null;

  try {
    const peer = JSON.parse(data) as PeerData;
    const now = Date.now();
    if (now - peer.updatedAt < PEER_TTL * 1000) {
      return peer;
    }
    // Stale peer
    await redis.hdel(key, peerId);
    return null;
  } catch {
    await redis.hdel(key, peerId);
    return null;
  }
}

/**
 * Remove a peer from the swarm
 */
export async function removePeer(
  infoHash: string,
  peerId: string
): Promise<void> {
  const key = PEER_KEY(infoHash);
  await redis.hdel(key, peerId);
}

/**
 * Get all peers for a torrent
 */
export async function getPeers(infoHash: string): Promise<PeerData[]> {
  const key = PEER_KEY(infoHash);
  const data = await redis.hgetall(key);

  const now = Date.now();
  const peers: PeerData[] = [];

  for (const [peerId, json] of Object.entries(data)) {
    try {
      const peer = JSON.parse(json) as PeerData;
      // Filter out stale peers (older than TTL)
      if (now - peer.updatedAt < PEER_TTL * 1000) {
        peers.push(peer);
      } else {
        // Cleanup stale peer
        await redis.hdel(key, peerId);
      }
    } catch {
      // Invalid JSON, remove it
      await redis.hdel(key, peerId);
    }
  }

  return peers;
}


// ============================================================================
// Stats Operations
// ============================================================================

/**
 * Increment completed count for a torrent
 */
export async function incrementCompleted(infoHash: string): Promise<number> {
  const key = STATS_KEY(infoHash);
  return redis.hincrby(key, 'completed', 1);
}

export interface TorrentStats {
  seeders: number;
  leechers: number;
  completed: number;
}

// Counting peers reads and parses the whole swarm hash: cache the result
// briefly. Lists, Torznab and every announce ask for these counts.
const STATS_CACHE_MS = 10_000;
const statsCache = new TtlCache<string, TorrentStats>(STATS_CACHE_MS, 100_000);

function countPeers(raw: Record<string, string>, now: number) {
  let seeders = 0;
  let leechers = 0;
  for (const json of Object.values(raw)) {
    try {
      const peer = JSON.parse(json) as PeerData;
      if (now - peer.updatedAt >= PEER_TTL * 1000) continue; // Stale
      if (peer.isSeeder) seeders++;
      else leechers++;
    } catch {
      // Invalid entry: cleaned up by getPeers
    }
  }
  return { seeders, leechers };
}

async function withSwarmFallback(
  infoHash: string,
  stats: TorrentStats
): Promise<TorrentStats> {
  // If no peers in Redis, try tracker's internal swarm data
  if (stats.seeders === 0 && stats.leechers === 0) {
    try {
      const { getSwarmStats } = await import('../tracker');
      const swarmStats = getSwarmStats(infoHash);
      if (swarmStats.seeders > 0 || swarmStats.leechers > 0) {
        return { ...swarmStats, completed: stats.completed };
      }
    } catch {
      // Tracker not available, continue with Redis data
    }
  }
  return stats;
}

/**
 * Get stats for several torrents in one Redis round trip (cached per torrent)
 */
export async function getStatsMany(
  infoHashes: string[]
): Promise<Map<string, TorrentStats>> {
  const result = new Map<string, TorrentStats>();
  const missing: string[] = [];

  for (const hash of infoHashes) {
    const cached = statsCache.get(hash);
    if (cached) result.set(hash, cached);
    else if (!missing.includes(hash)) missing.push(hash);
  }

  if (missing.length > 0) {
    const pipeline = redis.pipeline();
    for (const hash of missing) {
      pipeline.hgetall(PEER_KEY(hash));
      pipeline.hget(STATS_KEY(hash), 'completed');
    }
    const replies = (await pipeline.exec()) ?? [];
    const now = Date.now();

    await Promise.all(
      missing.map(async (hash, i) => {
        const peers = (replies[i * 2]?.[1] as Record<string, string> | null) ?? {};
        const completedRaw = replies[i * 2 + 1]?.[1] as string | null;
        const stats = await withSwarmFallback(hash, {
          ...countPeers(peers, now),
          completed: parseInt(completedRaw || '0', 10),
        });
        statsCache.set(hash, stats);
        result.set(hash, stats);
      })
    );
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

/**
 * Track global tracker stats
 */
export async function updateGlobalStats(
  torrents: number,
  peers: number,
  seeders: number
): Promise<void> {
  await redis.hset(GLOBAL_STATS_KEY, {
    torrents: torrents.toString(),
    peers: peers.toString(),
    seeders: seeders.toString(),
    updatedAt: Date.now().toString(),
  });
}

export async function getGlobalStats(): Promise<{
  torrents: number;
  peers: number;
  seeders: number;
  updatedAt: number;
}> {
  const data = await redis.hgetall(GLOBAL_STATS_KEY);
  return {
    torrents: parseInt(data.torrents || '0', 10),
    peers: parseInt(data.peers || '0', 10),
    seeders: parseInt(data.seeders || '0', 10),
    updatedAt: parseInt(data.updatedAt || '0', 10),
  };
}
