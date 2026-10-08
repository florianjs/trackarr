/**
 * Cached lookups for the announce hot path.
 *
 * Every announce needs the user behind the passkey and the torrent behind the
 * info hash, often several times. These rows change rarely, so they are kept
 * in memory for a few seconds; writes that matter (ban, role, passkey reset,
 * torrent approval/deletion) clear the caches through `invalidateTracker*`.
 * Invalid passkeys/hashes are cached too, which also absorbs floods of bad
 * announces.
 */

import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { TtlCache } from '../utils/ttlCache';

const TTL_MS = 30_000;

export interface TrackerUser {
  id: string;
  isBanned: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  uploaded: number;
  downloaded: number;
}

export interface TrackerTorrent {
  id: string;
  isActive: boolean;
  isApproved: boolean;
  uploaderId: string | null;
}

const users = new TtlCache<string, TrackerUser | null>(TTL_MS, 50_000);
const torrents = new TtlCache<string, TrackerTorrent | null>(TTL_MS, 50_000);
const snatches = new TtlCache<string, boolean>(TTL_MS, 100_000);

export function getTrackerUser(passkey: string): Promise<TrackerUser | null> {
  return users.getOrLoad(passkey, async () => {
    const [row] = await db
      .select({
        id: schema.users.id,
        isBanned: schema.users.isBanned,
        isAdmin: schema.users.isAdmin,
        isModerator: schema.users.isModerator,
        uploaded: schema.users.uploaded,
        downloaded: schema.users.downloaded,
      })
      .from(schema.users)
      .where(eq(schema.users.passkey, passkey))
      .limit(1);
    return row ?? null;
  });
}

export function getTrackerTorrent(infoHash: string): Promise<TrackerTorrent | null> {
  return torrents.getOrLoad(infoHash, async () => {
    const [row] = await db
      .select({
        id: schema.torrents.id,
        isActive: schema.torrents.isActive,
        isApproved: schema.torrents.isApproved,
        uploaderId: schema.torrents.uploaderId,
      })
      .from(schema.torrents)
      .where(eq(schema.torrents.infoHash, infoHash))
      .limit(1);
    return row ?? null;
  });
}

/** Whether the user really completed the torrent (an HnR entry exists) */
export function hasSnatched(userId: string, torrentId: string): Promise<boolean> {
  return snatches.getOrLoad(`${userId}:${torrentId}`, async () => {
    const [row] = await db
      .select({ id: schema.hnrTracking.id })
      .from(schema.hnrTracking)
      .where(
        and(
          eq(schema.hnrTracking.userId, userId),
          eq(schema.hnrTracking.torrentId, torrentId)
        )
      )
      .limit(1);
    return Boolean(row);
  });
}

export function markSnatched(userId: string, torrentId: string): void {
  snatches.set(`${userId}:${torrentId}`, true);
}

/** Call after banning, role or passkey changes */
export function invalidateTrackerUsers(): void {
  users.clear();
}

/** Call after approving, rejecting, deleting or deactivating torrents */
export function invalidateTrackerTorrents(): void {
  torrents.clear();
}
