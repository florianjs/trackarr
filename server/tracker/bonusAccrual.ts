/**
 * Seeding bonus accrual (issue #48)
 *
 * Called on each seeder announce. Points are only earned for torrents the
 * user really holds (uploader or completed snatch): `left=0` is client
 * supplied and must not let anyone farm points on any torrent. The number of
 * torrents earning at once is capped by the admin setting.
 *
 * Returns the points to credit; the caller writes them together with the
 * upload/download stats in a single UPDATE.
 */

import { redis } from '../redis/client';
import { computeSeedPoints } from '../utils/bonus';
import { getBonusSettings } from '../utils/settings';
import { hasSnatched, type TrackerTorrent } from './lookups';

const SEEDING_SET_TTL = 2 * 3600; // Seconds a torrent stays "currently seeding"

export async function computeSeedingBonus(params: {
  userId: string;
  infoHash: string;
  torrent: TrackerTorrent;
  elapsedSeconds: number;
}): Promise<number> {
  const settings = await getBonusSettings();
  if (!settings.enabled || settings.pointsPerSeedDay <= 0) return 0;

  const points = computeSeedPoints(params.elapsedSeconds, settings.pointsPerSeedDay);
  if (points <= 0 || !params.torrent.isApproved) return 0;

  if (
    params.torrent.uploaderId !== params.userId &&
    !(await hasSnatched(params.userId, params.torrent.id))
  ) {
    return 0;
  }

  // Cap concurrent earning torrents: a sorted set of recently seen hashes.
  // One round trip to read, one to write.
  const key = `bonus:seeding:${params.userId}`;
  const now = Date.now();
  const result = await redis
    .multi()
    .zremrangebyscore(key, 0, now - SEEDING_SET_TTL * 1000)
    .zscore(key, params.infoHash)
    .zcard(key)
    .exec();
  const known = result?.[1]?.[1] != null;
  const count = Number(result?.[2]?.[1] ?? 0);
  if (!known && count >= settings.maxSeedingTorrents) return 0;

  await redis
    .multi()
    .zadd(key, now, params.infoHash)
    .expire(key, SEEDING_SET_TTL)
    .exec();

  return points;
}
