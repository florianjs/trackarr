import { describe, it, expect, vi } from 'vitest';

vi.mock('../server/db', () => ({ db: {}, schema: {} }));
vi.mock('../server/redis/client', () => ({ redis: {} }));

const { swarmNumbers } = await import('../server/utils/publicStats');
const { parseGlobalStats } = await import('../server/redis/cache');

const now = 1_000_000_000;
const stats = (fields: Record<string, string>) => parseGlobalStats(fields);

describe('swarmNumbers', () => {
  it('reads peer entries and seeded torrents from the tracker counters', () => {
    expect(
      swarmNumbers(stats({ peers: '5', seededTorrents: '2', updatedAt: String(now - 60_000) }), now)
    ).toEqual({ activePeers: 5, seededTorrents: 2 });
  });

  it('is unknown when the tracker never published', () => {
    expect(swarmNumbers(stats({}), now)).toEqual({ activePeers: null, seededTorrents: null });
  });

  it('is unknown when the counters are stale', () => {
    expect(
      swarmNumbers(stats({ peers: '5', updatedAt: String(now - 31 * 60_000) }), now)
    ).toEqual({ activePeers: null, seededTorrents: null });
  });
});
