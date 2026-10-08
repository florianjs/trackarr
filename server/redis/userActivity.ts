/**
 * Per-user swarm activity: which torrents a user is currently seeding or
 * leeching, as sorted sets scored by last announce time. Entries older than
 * the peer TTL are ignored and pruned.
 */

import { redis } from './client';
import { PEER_TTL } from './peerCount';

const SEEDING_KEY = (userId: string) => `user:${userId}:seeding`;
const LEECHING_KEY = (userId: string) => `user:${userId}:leeching`;

export async function recordUserPeer(
  userId: string,
  infoHash: string,
  seeding: boolean
): Promise<void> {
  const now = Date.now();
  const [current, other] = seeding
    ? [SEEDING_KEY(userId), LEECHING_KEY(userId)]
    : [LEECHING_KEY(userId), SEEDING_KEY(userId)];
  await redis
    .multi()
    .zadd(current, now, infoHash)
    .zrem(other, infoHash)
    .expire(current, PEER_TTL)
    .exec();
}

export async function removeUserPeer(userId: string, infoHash: string): Promise<void> {
  await redis
    .multi()
    .zrem(SEEDING_KEY(userId), infoHash)
    .zrem(LEECHING_KEY(userId), infoHash)
    .exec();
}

export async function getUserActivity(
  userId: string
): Promise<{ seeding: number; leeching: number }> {
  const cutoff = Date.now() - PEER_TTL * 1000;
  const result = await redis
    .multi()
    .zremrangebyscore(SEEDING_KEY(userId), 0, cutoff)
    .zremrangebyscore(LEECHING_KEY(userId), 0, cutoff)
    .zcard(SEEDING_KEY(userId))
    .zcard(LEECHING_KEY(userId))
    .exec();
  return {
    seeding: Number(result?.[2]?.[1] ?? 0),
    leeching: Number(result?.[3]?.[1] ?? 0),
  };
}
