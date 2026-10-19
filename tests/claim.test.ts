import { describe, it, expect } from 'vitest';
import { claim, type ClaimStore } from '../server/redis/claim';

// Minimal in-memory SET NX PX, shared by every "node" using it
function memoryStore(clock: () => number): ClaimStore {
  const keys = new Map<string, number>();
  return {
    async set(key, _value, _px, ttlMs) {
      const expiresAt = keys.get(key);
      if (expiresAt !== undefined && expiresAt > clock()) return null;
      keys.set(key, clock() + ttlMs);
      return 'OK';
    },
  };
}

describe('claim', () => {
  it('grants a key to a single caller until it expires', async () => {
    let now = 0;
    const store = memoryStore(() => now);
    expect(await claim(store, 'job', 1000)).toBe(true);
    expect(await claim(store, 'job', 1000)).toBe(false);
    now = 1000;
    expect(await claim(store, 'job', 1000)).toBe(true);
  });

  it('lets only one of concurrent callers win', async () => {
    const store = memoryStore(() => 0);
    const results = await Promise.all([claim(store, 'k', 1000), claim(store, 'k', 1000)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('keeps keys independent', async () => {
    const store = memoryStore(() => 0);
    expect(await claim(store, 'a', 1000)).toBe(true);
    expect(await claim(store, 'b', 1000)).toBe(true);
  });
});
