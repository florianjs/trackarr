import { describe, it, expect, vi } from 'vitest';

vi.mock('../server/redis/client', () => ({ redis: {} }));

const { parseSwarmCounts, parseGlobalStats } = await import('../server/redis/cache');

describe('parseSwarmCounts', () => {
  it('reads "seeders:leechers" published by the tracker', () => {
    expect(parseSwarmCounts('3:7')).toEqual({ seeders: 3, leechers: 7 });
  });

  it('treats a missing or broken value as an empty swarm', () => {
    expect(parseSwarmCounts(null)).toEqual({ seeders: 0, leechers: 0 });
    expect(parseSwarmCounts('')).toEqual({ seeders: 0, leechers: 0 });
    expect(parseSwarmCounts('x:4')).toEqual({ seeders: 0, leechers: 4 });
  });
});

describe('parseGlobalStats', () => {
  it('defaults missing fields to zero', () => {
    expect(parseGlobalStats({ torrents: '2', uniquePeers: '9' })).toMatchObject({
      torrents: 2,
      uniquePeers: 9,
      peers: 0,
      updatedAt: 0,
    });
  });
});
