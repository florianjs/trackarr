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

async function load(): Promise<Map<string, string | null>> {
  const rows = await db.select({ ip: bannedIps.ip, reason: bannedIps.reason }).from(bannedIps);
  const reasons = new Map(rows.map((r) => [r.ip, r.reason]));
  cache = { reasons, loadedAt: Date.now() };
  return reasons;
}

async function getBannedIps(): Promise<Map<string, string | null>> {
  if (cache && Date.now() - cache.loadedAt < RELOAD_MS) return cache.reasons;
  loading ??= load().finally(() => (loading = null));
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
  cache = null;
}
