/**
 * Cross-node coordination: the first caller to claim a key wins until it
 * expires. Lets several app nodes share Redis without double-processing an
 * announce or running the same periodic job twice.
 */

export interface ClaimStore {
  set(key: string, value: string, px: 'PX', ttlMs: number, nx: 'NX'): Promise<'OK' | null>;
}

export async function claim(store: ClaimStore, key: string, ttlMs: number): Promise<boolean> {
  return (await store.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
}
