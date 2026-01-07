import {
  setPeer,
  removePeer,
  incrementCompleted,
  getPeers,
  getStats,
  getPeer,
} from '../redis/cache';
import { bufferToHex, isSeeder, type TrackerStats } from './types';
import { hashIP } from '../utils/crypto';
import { db, schema } from '../db';
import { sql, eq } from 'drizzle-orm';
import { createHnrEntry, updateSeedTime } from '../utils/hnr';

// Debug mode for verbose tracker logging (set TRACKER_DEBUG=true in .env)
const TRACKER_DEBUG = process.env.TRACKER_DEBUG === 'true';

// ============================================================================
// Deduplication Cache
// Prevents processing the same announce multiple times when clients
// announce on multiple network interfaces (IPv4, IPv6, localhost, etc.)
// ============================================================================
interface DedupeEntry {
  timestamp: number;
  uploaded: number;
  downloaded: number;
}

const announceDedupeCache = new Map<string, DedupeEntry>();
const DEDUPE_WINDOW_MS = 2000; // 2 seconds window for deduplication

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of announceDedupeCache) {
    if (now - entry.timestamp > DEDUPE_WINDOW_MS * 2) {
      announceDedupeCache.delete(key);
    }
  }
}, 10000);

// ============================================================================
// Announce Handler
// Called on every announce from peers
// ============================================================================
export async function handleAnnounce(params: {
  infoHash: Buffer;
  peerId: Buffer;
  ip: string;
  port: number;
  uploaded: number;
  downloaded: number;
  left: number;
  event?: 'started' | 'stopped' | 'completed' | 'update' | null;
  passkey?: string;
}): Promise<void> {
  const infoHash = bufferToHex(params.infoHash);
  const peerId = bufferToHex(params.peerId);
  const event = params.event || 'update';

  if (TRACKER_DEBUG) {
    console.log('[Tracker] handleAnnounce:', {
      infoHash: infoHash?.slice(0, 16) + '...',
      peerId: peerId?.slice(0, 16) + '...',
      event,
      ip: params.ip,
      port: params.port,
    });
  }

  // Validate required fields
  if (!infoHash || infoHash.length !== 40) {
    console.error(
      `[Tracker] Invalid infoHash: "${infoHash}" (length=${infoHash?.length}, raw=${typeof params.infoHash})`
    );
    return;
  }

  if (!peerId || peerId.length !== 40) {
    console.error(
      `[Tracker] Invalid peerId: "${peerId}" (length=${peerId?.length}, raw=${typeof params.peerId})`
    );
    return;
  }

  // ============================================================================
  // Deduplication: Clients announce on ALL network interfaces (IPv4, IPv6, etc.)
  // We only process the first announce per peerId+infoHash+event within the window
  // ============================================================================
  const dedupeKey = `${infoHash}:${peerId}:${event}`;
  const now = Date.now();
  const existingEntry = announceDedupeCache.get(dedupeKey);

  if (existingEntry && now - existingEntry.timestamp < DEDUPE_WINDOW_MS) {
    // Already processed this announce recently, skip
    return;
  }

  // Store this announce in dedupe cache
  announceDedupeCache.set(dedupeKey, {
    timestamp: now,
    uploaded: params.uploaded,
    downloaded: params.downloaded,
  });

  const ipHash = hashIP(params.ip);
  if (TRACKER_DEBUG) {
    console.log(
      `[Tracker] ANNOUNCE: event=${event} hash=${infoHash.slice(0, 12)}... peer=${peerId.slice(0, 8)}... ipHash=${ipHash} port=${params.port} left=${params.left}`
    );
  }

  // Calculate deltas for user stats
  const previousPeer = await getPeer(infoHash, peerId);
  let deltaUploaded = 0;
  let deltaDownloaded = 0;

  if (previousPeer) {
    deltaUploaded = Math.max(0, params.uploaded - previousPeer.uploaded);
    deltaDownloaded = Math.max(0, params.downloaded - previousPeer.downloaded);
  } else {
    // First announce for this peer in this session - don't credit full amount
    // The client sends cumulative session stats, but on first announce we can't know the baseline
    // So we store the current values and only credit deltas on subsequent announces
    deltaUploaded = 0;
    deltaDownloaded = 0;
  }

  // Update user stats if passkey is provided
  if (params.passkey && (deltaUploaded > 0 || deltaDownloaded > 0)) {
    await db
      .update(schema.users)
      .set({
        uploaded: sql`${schema.users.uploaded} + ${deltaUploaded}`,
        downloaded: sql`${schema.users.downloaded} + ${deltaDownloaded}`,
      })
      .where(eq(schema.users.passkey, params.passkey));
  }

  if (event === 'stopped') {
    // Remove peer from swarm
    await removePeer(infoHash, peerId);
    return;
  }

  // Add/update peer
  await setPeer(infoHash, peerId, {
    ip: params.ip,
    port: params.port,
    uploaded: params.uploaded,
    downloaded: params.downloaded,
    left: params.left,
    isSeeder: isSeeder(params.left),
  });

  // Track completed downloads
  if (event === 'completed') {
    await incrementCompleted(infoHash);

    // Create HnR tracking entry
    if (params.passkey) {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.passkey, params.passkey),
        columns: { id: true },
      });
      const torrent = await db.query.torrents.findFirst({
        where: eq(schema.torrents.infoHash, infoHash),
        columns: { id: true },
      });
      if (user && torrent) {
        await createHnrEntry(user.id, torrent.id);
      }
    }
  }

  // Update seed time for HnR tracking (seeders only)
  if (params.passkey && isSeeder(params.left) && previousPeer) {
    const timeSinceLastAnnounce = Math.floor(
      (Date.now() - previousPeer.updatedAt) / 1000
    );
    if (timeSinceLastAnnounce > 0 && timeSinceLastAnnounce < 3600) {
      // Max 1 hour per announce
      const user = await db.query.users.findFirst({
        where: eq(schema.users.passkey, params.passkey),
        columns: { id: true },
      });
      const torrent = await db.query.torrents.findFirst({
        where: eq(schema.torrents.infoHash, infoHash),
        columns: { id: true },
      });
      if (user && torrent) {
        await updateSeedTime(user.id, torrent.id, timeSinceLastAnnounce);
      }
    }
  }
}

// ============================================================================
// Scrape Handler
// Returns stats for torrents
// ============================================================================
export async function handleScrape(
  infoHashes: Buffer[]
): Promise<TrackerStats[]> {
  const results: TrackerStats[] = [];

  for (const hashBuf of infoHashes) {
    const infoHash = bufferToHex(hashBuf);
    const stats = await getStats(infoHash);

    results.push({
      infoHash,
      complete: stats.seeders,
      incomplete: stats.leechers,
      downloaded: stats.completed,
    });
  }

  return results;
}

// ============================================================================
// Get Peers for Announce Response
// ============================================================================
export async function getPeersForAnnounce(
  infoHash: string,
  numwant: number,
  excludePeerId?: string
): Promise<Array<{ ip: string; port: number }>> {
  const peers = await getPeers(infoHash);

  // Filter out the requesting peer and limit to numwant
  return peers
    .filter((p) => p.peerId !== excludePeerId)
    .slice(0, numwant)
    .map((p) => ({ ip: p.ip, port: p.port }));
}
