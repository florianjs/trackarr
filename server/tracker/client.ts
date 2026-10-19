/**
 * The tracker runs as a separate Rust service (`tracker/`). This module is
 * the web app's side of the link:
 *
 * - cache invalidation, published on Redis (`<prefix>tracker:invalidate`):
 *   the tracker keeps users, torrents and settings for 30 s otherwise
 * - its private HTTP API (`TRACKER_INTERNAL_URL`), for swarm peers and status
 */

import { readOptionalSecret } from '../utils/secrets';

export type TrackerInvalidation = 'users' | 'torrents' | 'settings' | `torrent:${string}`;

// ioredis prefixes keys, not pub/sub channels: add the prefix ourselves
function invalidationChannel(): string {
  return `${process.env.REDIS_KEY_PREFIX || 'ot:'}tracker:invalidate`;
}

/** Fire and forget: caches expire on their own if the message is lost */
export function invalidateTracker(message: TrackerInvalidation): void {
  // Loaded on use: settings import this module, and must not open Redis
  import('../redis/client')
    .then(({ redis }) => redis.publish(invalidationChannel(), message))
    .catch((err) => {
      console.error('[Tracker] Invalidation not sent:', err);
    });
}

/** Call after banning, role or passkey changes */
export function invalidateTrackerUsers(): void {
  invalidateTracker('users');
}

/** Call after approving, rejecting or deactivating torrents */
export function invalidateTrackerTorrents(): void {
  invalidateTracker('torrents');
}

/** Torrent deleted: the tracker also drops its swarm */
export function invalidateTrackerTorrent(infoHash: string): void {
  invalidateTracker(`torrent:${infoHash.toLowerCase()}`);
}

const INTERNAL_TIMEOUT_MS = 2000;

/** GET on the tracker's private API; null when it cannot be reached */
export async function trackerInternal<T>(path: string): Promise<T | null> {
  const base = process.env.TRACKER_INTERNAL_URL || 'http://localhost:8090';
  const token = readOptionalSecret('TRACKER_INTERNAL_TOKEN');
  try {
    const res = await fetch(`${base}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[Tracker] Internal API ${path}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[Tracker] Internal API ${path} unreachable:`, (err as Error).message);
    return null;
  }
}

export interface TrackerStatus {
  uptimeSeconds: number;
  announces: number;
  swarms: number;
  seeders: number;
  leechers: number;
  pendingAccounting: number;
  /** Counters published to Redis since start (warm-up over) */
  published: boolean;
  /** Over the last minute */
  announcesPerSecond: number;
  rejected: {
    invalidPasskey: number;
    unknownTorrent: number;
    tooManyPeers: number;
    blockedClient: number;
  };
  /** Clients currently refused for too many failed lookups */
  blockedClients: number;
}

export function getTrackerStatus(): Promise<TrackerStatus | null> {
  return trackerInternal<TrackerStatus>('/internal/status');
}
