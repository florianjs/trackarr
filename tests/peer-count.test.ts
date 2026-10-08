import { describe, it, expect } from 'vitest';
import { countPeers } from '../server/redis/peerCount';

const now = 1_000_000_000;
const peer = (isSeeder: boolean, ageSec: number) =>
  JSON.stringify({ isSeeder, updatedAt: now - ageSec * 1000 });

describe('countPeers', () => {
  it('counts live seeders and leechers', () => {
    expect(countPeers({ a: peer(true, 10), b: peer(false, 10), c: peer(false, 60) }, now)).toEqual({
      seeders: 1,
      leechers: 2,
      stale: [],
    });
  });

  it('collects stale and invalid entries for cleanup', () => {
    const result = countPeers({ live: peer(true, 10), old: peer(false, 1800), broken: '{not json' }, now);
    expect(result.seeders).toBe(1);
    expect(result.leechers).toBe(0);
    expect(result.stale.sort()).toEqual(['broken', 'old']);
  });
});
