import { describe, it, expect } from 'vitest';
import { TtlCache } from '../server/utils/ttlCache';

describe('TtlCache', () => {
  it('expires entries after the ttl', () => {
    let now = 0;
    const cache = new TtlCache<string, number>(1000, 10, () => now);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    now = 999;
    expect(cache.get('a')).toBe(1);
    now = 1000;
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the oldest entry when full', () => {
    const cache = new TtlCache<string, number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('shares one load between concurrent callers', async () => {
    const cache = new TtlCache<string, number>(1000);
    let loads = 0;
    const load = async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 5));
      return 42;
    };
    const values = await Promise.all([cache.getOrLoad('k', load), cache.getOrLoad('k', load)]);
    expect(values).toEqual([42, 42]);
    expect(loads).toBe(1);
    expect(await cache.getOrLoad('k', load)).toBe(42);
    expect(loads).toBe(1);
  });

  it('does not cache failed loads', async () => {
    const cache = new TtlCache<string, number>(1000);
    await expect(cache.getOrLoad('k', () => Promise.reject(new Error('db down')))).rejects.toThrow();
    expect(await cache.getOrLoad('k', async () => 7)).toBe(7);
  });

  it('caches null values (negative lookups)', async () => {
    const cache = new TtlCache<string, number | null>(1000);
    let loads = 0;
    await cache.getOrLoad('missing', async () => { loads++; return null; });
    await cache.getOrLoad('missing', async () => { loads++; return null; });
    expect(loads).toBe(1);
  });
});

describe('TtlCache invalidation during a load', () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  }

  it('does not cache a result loaded before clear()', async () => {
    const cache = new TtlCache<string, string>(1000);
    const slow = deferred<string>();
    const first = cache.getOrLoad('user', () => slow.promise);

    cache.clear(); // e.g. the user was banned while the row was being read
    const second = cache.getOrLoad('user', async () => 'banned');

    slow.resolve('not banned');
    expect(await first).toBe('not banned'); // the original caller still gets its answer
    expect(await second).toBe('banned'); // later callers do not share the stale load
    expect(cache.get('user')).toBe('banned');
  });

  it('does not cache a result loaded before delete()', async () => {
    const cache = new TtlCache<string, string>(1000);
    const slow = deferred<string>();
    const first = cache.getOrLoad('k', () => slow.promise);
    cache.delete('k');
    slow.resolve('old');
    await first;
    expect(cache.get('k')).toBeUndefined();
  });
});
