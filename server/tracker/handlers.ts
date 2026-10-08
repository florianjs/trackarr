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
import { createHash } from 'crypto';
import { computeCredit, getMaxRateBytes } from './credit';
import { computeSeedingBonus } from './bonusAccrual';
import { recordUserPeer, removeUserPeer } from '../redis/userActivity';
import { getTrackerTorrent, getTrackerUser, markSnatched } from './lookups';
import { getFreeleechState } from '../utils/settings';

function hashOwner(passkey: string): string {
  return createHash('sha256').update(`peer-owner:${passkey}`).digest('hex').slice(0, 16);
}

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

  // Peers are keyed by peer_id, which clients choose freely: bind each entry
  // to its owner so one user cannot skew or evict another user's peer.
  const owner = params.passkey ? hashOwner(params.passkey) : undefined;
  const previousPeer = await getPeer(infoHash, peerId);
  if (previousPeer?.owner && previousPeer.owner !== owner) {
    return;
  }

  const otherLeechers = previousPeer
    ? (await getStats(infoHash)).leechers - (previousPeer.isSeeder ? 0 : 1)
    : 0;
  const credit = computeCredit({
    previous: previousPeer,
    uploaded: params.uploaded,
    downloaded: params.downloaded,
    now: Date.now(),
    otherLeechers,
    maxRateBytes: getMaxRateBytes(),
  });
  const deltaUploaded = credit.uploaded;
  // Global freeleech: downloaded data does not count against the ratio
  const { active: freeleech } = await getFreeleechState();
  const deltaDownloaded = freeleech ? 0 : credit.downloaded;

  // The filter already validated passkey and torrent; these lookups are
  // cached, so they cost no extra query on the hot path
  const [user, torrent] = params.passkey
    ? await Promise.all([getTrackerUser(params.passkey), getTrackerTorrent(infoHash)])
    : [null, null];

  const seeding = isSeeder(params.left);
  const elapsedSeconds = previousPeer
    ? Math.floor((Date.now() - previousPeer.updatedAt) / 1000)
    : 0;

  // Bonus points for seeding (issue #48); never block the announce on it
  const bonusPoints =
    user && torrent && seeding && previousPeer
      ? await computeSeedingBonus({
          userId: user.id,
          infoHash,
          torrent,
          elapsedSeconds,
        }).catch((err) => {
          console.error('[Bonus] Seeding accrual failed:', err);
          return 0;
        })
      : 0;

  // One write for upload, download and bonus points
  if (user && (deltaUploaded > 0 || deltaDownloaded > 0 || bonusPoints > 0)) {
    await db
      .update(schema.users)
      .set({
        uploaded: sql`${schema.users.uploaded} + ${deltaUploaded}`,
        downloaded: sql`${schema.users.downloaded} + ${deltaDownloaded}`,
        bonusPoints: sql`${schema.users.bonusPoints} + ${bonusPoints}`,
      })
      .where(eq(schema.users.id, user.id));
  }

  if (event === 'stopped') {
    // Remove peer from swarm
    await removePeer(infoHash, peerId);
    if (user) await removeUserPeer(user.id, infoHash);
    return;
  }

  // Add/update peer
  await setPeer(infoHash, peerId, {
    owner,
    ip: params.ip,
    port: params.port,
    uploaded: params.uploaded,
    downloaded: params.downloaded,
    left: params.left,
    isSeeder: seeding,
  });
  if (user) await recordUserPeer(user.id, infoHash, seeding);

  // Track completed downloads
  if (event === 'completed') {
    await incrementCompleted(infoHash);

    // Create HnR tracking entry
    if (user && torrent) {
      await createHnrEntry(user.id, torrent.id);
      markSnatched(user.id, torrent.id);
    }
  }

  // Update seed time for HnR tracking (seeders only, max 1 hour per announce)
  if (user && torrent && seeding && elapsedSeconds > 0 && elapsedSeconds < 3600) {
    await updateSeedTime(user.id, torrent.id, elapsedSeconds);
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
