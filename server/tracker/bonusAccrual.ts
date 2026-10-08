/**
 * Seeding bonus accrual (issue #48)
 *
 * Called on each seeder announce. Points are only earned for torrents the
 * user really holds (uploader or completed snatch): `left=0` is client
 * supplied and must not let anyone farm points on any torrent. The number of
 * torrents earning at once is capped by the admin setting.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { redis } from '../redis/client';
import { computeSeedPoints } from '../utils/bonus';
import { getBonusSettings } from '../utils/settings';

const SEEDING_SET_TTL = 2 * 3600; // Seconds a torrent stays "currently seeding"

export async function accrueSeedingBonus(params: {
  passkey: string;
  infoHash: string;
  elapsedSeconds: number;
}): Promise<void> {
  const settings = await getBonusSettings();
  if (!settings.enabled || settings.pointsPerSeedDay <= 0) return;

  const points = computeSeedPoints(params.elapsedSeconds, settings.pointsPerSeedDay);
  if (points <= 0) return;

  const [user, torrent] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.passkey, params.passkey),
      columns: { id: true, isBanned: true },
    }),
    db.query.torrents.findFirst({
      where: eq(schema.torrents.infoHash, params.infoHash),
      columns: { id: true, uploaderId: true, isApproved: true },
    }),
  ]);
  if (!user || user.isBanned || !torrent || !torrent.isApproved) return;

  if (torrent.uploaderId !== user.id) {
    const snatch = await db.query.hnrTracking.findFirst({
      where: and(
        eq(schema.hnrTracking.userId, user.id),
        eq(schema.hnrTracking.torrentId, torrent.id)
      ),
      columns: { id: true },
    });
    if (!snatch) return;
  }

  // Cap concurrent earning torrents: a sorted set of recently seen hashes
  const key = `bonus:seeding:${user.id}`;
  const now = Date.now();
  await redis.zremrangebyscore(key, 0, now - SEEDING_SET_TTL * 1000);
  const known = (await redis.zscore(key, params.infoHash)) !== null;
  if (!known && (await redis.zcard(key)) >= settings.maxSeedingTorrents) return;
  await redis.zadd(key, now, params.infoHash);
  await redis.expire(key, SEEDING_SET_TTL);

  await db
    .update(schema.users)
    .set({ bonusPoints: sql`${schema.users.bonusPoints} + ${points}` })
    .where(eq(schema.users.id, user.id));
}
