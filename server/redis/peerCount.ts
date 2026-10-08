// Peers not refreshed within this window are gone (standard interval: 30 min)
export const PEER_TTL = 1800;

/**
 * Count live peers in a swarm hash and collect the fields to delete
 * (stale or invalid entries). Pure: no Redis access.
 */
export function countPeers(raw: Record<string, string>, now: number) {
  let seeders = 0;
  let leechers = 0;
  const stale: string[] = [];
  for (const [peerId, json] of Object.entries(raw)) {
    try {
      const peer = JSON.parse(json) as { isSeeder: boolean; updatedAt: number };
      if (now - peer.updatedAt >= PEER_TTL * 1000) {
        stale.push(peerId);
        continue;
      }
      if (peer.isSeeder) seeders++;
      else leechers++;
    } catch {
      stale.push(peerId);
    }
  }
  return { seeders, leechers, stale };
}
