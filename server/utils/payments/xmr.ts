/**
 * Monero: one subaddress per invoice from a view-only wallet served by
 * monero-wallet-rpc (MONERO_WALLET_RPC_URL). A view-only wallet sees incoming
 * payments but cannot spend. The RPC has no login here: keep it on a private
 * network (see doc/guide/paid-registration.md).
 */

import { jsonRpc, trimSlash, type ChainReceipt } from './http';

export function moneroRpcUrl(): string | null {
  const url = process.env.MONERO_WALLET_RPC_URL?.trim();
  return url ? `${trimSlash(url)}/json_rpc` : null;
}

function requireRpc(): string {
  const url = moneroRpcUrl();
  if (!url) throw new Error('MONERO_WALLET_RPC_URL is not set');
  return url;
}

export async function createXmrSubaddress(label: string): Promise<{ address: string; index: number }> {
  const result = await jsonRpc<{ address: string; address_index: number }>(
    requireRpc(),
    'create_address',
    { account_index: 0, label }
  );
  return { address: result.address, index: result.address_index };
}

export interface MoneroTransfer {
  txid: string;
  amount: number;
  confirmations?: number;
  timestamp?: number;
  subaddr_index?: { major: number; minor: number };
}

/**
 * Sum what subaddress `index` received, split by confirmation depth. Transfers
 * older than `notBefore` (unix seconds) are ignored: a wallet restored from
 * scratch hands out subaddresses that were already paid.
 */
export function sumMoneroTransfers(
  incoming: MoneroTransfer[],
  pool: MoneroTransfer[],
  index: number,
  minConfirmations: number,
  notBefore = 0
): ChainReceipt {
  let confirmed = 0n;
  let unconfirmed = 0n;
  const txids = new Set<string>();
  const mine = (t: MoneroTransfer) =>
    (!t.subaddr_index || t.subaddr_index.minor === index) && (t.timestamp ?? notBefore) >= notBefore;
  for (const t of incoming.filter(mine)) {
    txids.add(t.txid);
    if ((t.confirmations ?? 0) >= minConfirmations) confirmed += BigInt(t.amount);
    else unconfirmed += BigInt(t.amount);
  }
  for (const t of pool.filter(mine)) {
    txids.add(t.txid);
    unconfirmed += BigInt(t.amount);
  }
  return { confirmed, unconfirmed, txids: [...txids] };
}

export async function checkXmrSubaddress(
  index: number,
  minConfirmations: number,
  notBefore = 0
): Promise<ChainReceipt> {
  const result = await jsonRpc<{ in?: MoneroTransfer[]; pool?: MoneroTransfer[] }>(
    requireRpc(),
    'get_transfers',
    { in: true, pool: true, account_index: 0, subaddr_indices: [index] }
  );
  return sumMoneroTransfers(result.in ?? [], result.pool ?? [], index, minConfirmations, notBefore);
}
