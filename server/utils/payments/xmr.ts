/**
 * Monero: one subaddress per invoice from a view-only wallet served by
 * monero-wallet-rpc (MONERO_WALLET_RPC_URL). A view-only wallet sees incoming
 * payments but cannot spend. The RPC has no login here: keep it on a private
 * network (see doc/guide/paid-registration.md).
 *
 * The wallet file is created by the server from the admin's primary address
 * and private view key (createViewWallet), protected by MONERO_WALLET_PASSWORD,
 * and reopened on demand after the RPC restarts.
 */

import { jsonRpc, trimSlash, type ChainReceipt } from './http';

export const MONERO_WALLET_FILE = 'trackarr-view';

export function moneroRpcUrl(): string | null {
  const url = process.env.MONERO_WALLET_RPC_URL?.trim();
  return url ? `${trimSlash(url)}/json_rpc` : null;
}

function requireRpc(): string {
  const url = moneroRpcUrl();
  if (!url) throw new Error('MONERO_WALLET_RPC_URL is not set');
  return url;
}

function walletPassword(): string {
  return process.env.MONERO_WALLET_PASSWORD ?? '';
}

const isNoWallet = (err: unknown) => /no wallet file/i.test((err as Error).message);

/**
 * RPC call on the wallet; after a restart the RPC has no wallet open: open
 * ours and retry once
 */
async function walletRpc<T>(method: string, params: unknown): Promise<T> {
  const url = requireRpc();
  try {
    return await jsonRpc<T>(url, method, params);
  } catch (err) {
    if (!isNoWallet(err)) throw err;
    try {
      await jsonRpc(url, 'open_wallet', { filename: MONERO_WALLET_FILE, password: walletPassword() });
    } catch (openErr) {
      throw new Error(`Monero wallet not available: ${(openErr as Error).message}`);
    }
    return jsonRpc<T>(url, method, params);
  }
}

// Primary addresses: mainnet 4, testnet 9/A, stagenet 5 (subaddresses start with 8)
const PRIMARY_ADDRESS = /^[459A][1-9A-HJ-NP-Za-km-z]{94}$/;
const VIEW_KEY = /^[0-9a-f]{64}$/;

export function isMoneroPrimaryAddress(value: string): boolean {
  return PRIMARY_ADDRESS.test(value);
}

export function isMoneroViewKey(value: string): boolean {
  return VIEW_KEY.test(value);
}

/** Create the view-only wallet file (fails if it already exists) */
export async function createViewWallet(input: {
  address: string;
  viewKey: string;
  restoreHeight: number;
}): Promise<void> {
  await jsonRpc(requireRpc(), 'generate_from_keys', {
    filename: MONERO_WALLET_FILE,
    address: input.address,
    viewkey: input.viewKey,
    password: walletPassword(),
    restore_height: input.restoreHeight,
    autosave_current: true,
  });
}

export interface MoneroWalletStatus {
  /** MONERO_WALLET_RPC_URL is set */
  configured: boolean;
  /** Wallet open (or reopened) and answering */
  ready: boolean;
  address: string | null;
  /** Last block scanned by the wallet */
  height: number | null;
  error: string | null;
}

export async function moneroWalletStatus(): Promise<MoneroWalletStatus> {
  if (!moneroRpcUrl()) {
    return { configured: false, ready: false, address: null, height: null, error: null };
  }
  try {
    const { address } = await walletRpc<{ address: string }>('get_address', { account_index: 0 });
    const { height } = await walletRpc<{ height: number }>('get_height', {});
    return { configured: true, ready: true, address, height, error: null };
  } catch (err) {
    return { configured: true, ready: false, address: null, height: null, error: (err as Error).message };
  }
}

export async function createXmrSubaddress(label: string): Promise<{ address: string; index: number }> {
  const result = await walletRpc<{ address: string; address_index: number }>('create_address', {
    account_index: 0,
    label,
  });
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
  const result = await walletRpc<{ in?: MoneroTransfer[]; pool?: MoneroTransfer[] }>('get_transfers', {
    in: true,
    pool: true,
    account_index: 0,
    subaddr_indices: [index],
  });
  return sumMoneroTransfers(result.in ?? [], result.pool ?? [], index, minConfirmations, notBefore);
}
