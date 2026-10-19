import { describe, it, expect, vi } from 'vitest';

vi.mock('../server/db', () => ({ db: {}, schema: {} }));
vi.mock('../server/redis/client', () => ({ redis: {} }));

const { aggregateSwarms } = await import('../server/utils/publicStats');

const now = 1_000_000_000;
const peer = (isSeeder: boolean, ageSec = 10) => JSON.stringify({ isSeeder, updatedAt: now - ageSec * 1000 });

describe('aggregateSwarms', () => {
  it('counts live peers and torrents with a seeder', () => {
    expect(
      aggregateSwarms(
        [
          { a: peer(true), b: peer(false) },
          { c: peer(false), d: peer(false) },
          { e: peer(true) },
        ],
        now
      )
    ).toEqual({ activePeers: 5, seededTorrents: 2 });
  });

  it('ignores stale peers, so a swarm of departed seeders is not seeded', () => {
    expect(aggregateSwarms([{ a: peer(true, 3600) }, {}], now)).toEqual({
      activePeers: 0,
      seededTorrents: 0,
    });
  });
});
