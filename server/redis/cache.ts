import { redis } from './client';
import { hashIP } from '../utils/crypto';

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

/**
 * Get peer count for a torrent (seeders + leechers)
 */
export async function getPeerCount(
  infoHash: string
): Promise<{ seeders: number; leechers: number }> {
  const peers = await getPeers(infoHash);
  return {
    seeders: peers.filter((p) => p.isSeeder).length,
    leechers: peers.filter((p) => !p.isSeeder).length,
  };
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

/**
 * Get cached stats for a torrent
 * Falls back to tracker's internal swarm data if Redis cache is empty
 */
export async function getStats(
  infoHash: string
): Promise<{ seeders: number; leechers: number; completed: number }> {
  const [peerCount, completedRaw] = await Promise.all([
    getPeerCount(infoHash),
    redis.hget(STATS_KEY(infoHash), 'completed'),
  ]);

  // If no peers in Redis, try tracker's internal swarm data
  // This is more reliable as it reflects real-time state
  if (peerCount.seeders === 0 && peerCount.leechers === 0) {
    try {
      const { getSwarmStats } = await import('../tracker');
      const swarmStats = getSwarmStats(infoHash);
      if (swarmStats.seeders > 0 || swarmStats.leechers > 0) {
        return {
          ...swarmStats,
          completed: parseInt(completedRaw || '0', 10),
        };
      }
    } catch {
      // Tracker not available, continue with Redis data
    }
  }

  return {
    ...peerCount,
    completed: parseInt(completedRaw || '0', 10),
  };
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
