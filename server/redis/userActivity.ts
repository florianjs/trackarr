/**
 * Per-user swarm activity: how many torrents a user is currently seeding or
 * leeching. Published by the tracker service every minute as
 * `tracker:user_activity` (user id → "seeding:leeching").
 */

import { redis } from './client';
import { parseSwarmCounts } from './cache';

const ACTIVITY_KEY = 'tracker:user_activity';

export async function getUserActivity(
  userId: string
): Promise<{ seeding: number; leeching: number }> {
  const { seeders, leechers } = parseSwarmCounts(await redis.hget(ACTIVITY_KEY, userId));
  return { seeding: seeders, leeching: leechers };
}
