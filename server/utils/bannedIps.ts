/**
 * Banned IPs, checked on every request by the security middleware.
 * The table is small and rarely written: keep it in memory, reload it every
 * 30 seconds, and immediately after a ban/unban (`invalidateBannedIps`).
 */

import { db } from '../db';
import { bannedIps } from '../db/schema';

const RELOAD_MS = 30_000;

let cache: { reasons: Map<string, string | null>; loadedAt: number } | null = null;
let loading: Promise<Map<string, string | null>> | null = null;
// Bumped on invalidation: a load that started before a ban/unban must not
// publish its outdated result afterwards
let generation = 0;

async function load(): Promise<Map<string, string | null>> {
  const startedAt = generation;
  const rows = await db.select({ ip: bannedIps.ip, reason: bannedIps.reason }).from(bannedIps);
  const reasons = new Map(rows.map((r) => [r.ip, r.reason]));
  if (startedAt === generation) {
    cache = { reasons, loadedAt: Date.now() };
  }
  return reasons;
}

async function getBannedIps(): Promise<Map<string, string | null>> {
  if (cache && Date.now() - cache.loadedAt < RELOAD_MS) return cache.reasons;
  if (!loading) {
    const current = load().finally(() => {
      if (loading === current) loading = null;
    });
    loading = current;
  }
  return loading;
}

/**
 * Returns the ban reason (or null when banned without reason), or undefined
 * when the IP is not banned.
 */
export async function getIpBan(ip: string): Promise<string | null | undefined> {
  const reasons = await getBannedIps();
  return reasons.has(ip) ? (reasons.get(ip) ?? null) : undefined;
}

export function invalidateBannedIps(): void {
  generation++;
  cache = null;
  // Requests after the ban/unban start a fresh load instead of joining an
  // in-flight one that may predate the write
  loading = null;
}
