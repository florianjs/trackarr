/**
 * Small in-process cache with per-entry expiry and a size bound.
 * Used on hot paths (tracker announces, middleware) to avoid re-reading
 * rows that change rarely. Values may be up to `ttlMs` stale: only use it
 * where that is acceptable, and call `delete`/`clear` on writes.
 */
export class TtlCache<K, V> {
  private entries = new Map<K, { value: V; expiresAt: number }>();
  private pending = new Map<K, Promise<V>>();
  // Bumped by delete/clear: a load started before an invalidation must not
  // write its (possibly stale) result back afterwards
  private generation = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize = 10_000,
    private readonly now: () => number = Date.now
  ) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
      // Map keeps insertion order: drop the oldest entry
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  /**
   * Return the cached value or load it once; concurrent callers for the same
   * key share the same pending load.
   */
  async getOrLoad(key: K, load: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;

    const pending = this.pending.get(key);
    if (pending) return pending;

    const generation = this.generation;
    const promise = load()
      .then((value) => {
        if (generation === this.generation) this.set(key, value);
        return value;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  delete(key: K): void {
    this.generation++;
    this.entries.delete(key);
    this.pending.delete(key);
  }

  clear(): void {
    this.generation++;
    this.entries.clear();
    // Callers arriving after the invalidation start a fresh load
    this.pending.clear();
  }

  get size(): number {
    return this.entries.size;
  }

}
