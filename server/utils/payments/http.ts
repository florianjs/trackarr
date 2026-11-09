/**
 * Small HTTP helpers for the chain backends (Esplora, monero-wallet-rpc,
 * Solana JSON-RPC). Every call is bounded: a slow node must not stall the
 * payment watcher.
 */

const TIMEOUT_MS = 10_000;

/** Amounts seen on-chain for one invoice, in the smallest unit */
export interface ChainReceipt {
  /** With enough confirmations */
  confirmed: bigint;
  /** Seen (mempool, pool, not yet final) but not confirmed enough */
  unconfirmed: bigint;
  txids: string[];
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${new URL(url).host}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function getText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${new URL(url).host}: HTTP ${res.status}`);
  return res.text();
}

/** JSON-RPC 2.0 call; throws on transport and RPC errors */
export async function jsonRpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '0', method, params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message ?? 'RPC error'}`);
  return body.result as T;
}

export function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
