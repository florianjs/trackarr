/**
 * Bitcoin: one native SegWit (BIP84, p2wpkh) address per invoice, derived
 * from the admin's extended public key on the receive chain (.../0/index).
 * The server never holds a private key. Payments are read from an Esplora
 * API (mempool.space by default, or a self-hosted instance).
 */

import { HDKey } from '@scure/bip32';
import { bech32 } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import { getJson, getText, trimSlash, type ChainReceipt } from './http';

// SLIP-132 version bytes of the public extended keys we accept
const PUBLIC_VERSIONS: Record<string, { version: number; hrp: 'bc' | 'tb' }> = {
  xpub: { version: 0x0488b21e, hrp: 'bc' },
  zpub: { version: 0x04b24746, hrp: 'bc' },
  tpub: { version: 0x043587cf, hrp: 'tb' },
  vpub: { version: 0x045f1cf6, hrp: 'tb' },
};

/** Parse an extended public key; private keys and other formats are refused */
export function parseExtendedPublicKey(key: string): { node: HDKey; hrp: 'bc' | 'tb' } {
  const prefix = key.slice(0, 4);
  const kind = PUBLIC_VERSIONS[prefix];
  if (!kind) {
    throw new Error(
      prefix.endsWith('prv')
        ? 'This is a private key: paste the extended PUBLIC key (xpub/zpub)'
        : 'Unsupported key: expected xpub, zpub, tpub or vpub'
    );
  }
  // Only the public version matters: HDKey checks the one in the key
  const node = HDKey.fromExtendedKey(key, { public: kind.version, private: 0 });
  if (node.privateKey) throw new Error('Private keys are not accepted');
  return { node, hrp: kind.hrp };
}

/** Receive address number `index` (account-level key: child 0/index) */
export function deriveBtcAddress(extendedKey: string, index: number): string {
  const { node, hrp } = parseExtendedPublicKey(extendedKey);
  const child = node.deriveChild(0).deriveChild(index);
  if (!child.publicKey) throw new Error('Derivation failed');
  const program = ripemd160(sha256(child.publicKey));
  return bech32.encode(hrp, [0, ...bech32.toWords(program)]);
}

export interface EsploraTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
  vout: { scriptpubkey_address?: string; value: number }[];
}

/**
 * Sum what `address` received, split by confirmation depth. Blocks older than
 * `notBefore` (unix seconds) are ignored: an address that was already used
 * (xpub shared with another wallet) must not pay for a new invoice.
 */
export function sumEsploraTxs(
  txs: EsploraTx[],
  address: string,
  tipHeight: number,
  minConfirmations: number,
  notBefore = 0
): ChainReceipt {
  let confirmed = 0n;
  let unconfirmed = 0n;
  const txids: string[] = [];
  for (const tx of txs) {
    if (tx.status.confirmed && (tx.status.block_time ?? 0) < notBefore) continue;
    const value = tx.vout
      .filter((out) => out.scriptpubkey_address === address)
      .reduce((sum, out) => sum + BigInt(out.value), 0n);
    if (value === 0n) continue;
    txids.push(tx.txid);
    const depth =
      tx.status.confirmed && tx.status.block_height !== undefined
        ? tipHeight - tx.status.block_height + 1
        : 0;
    // 0 confirmations: the mempool is enough (fast, but double-spendable)
    if (depth >= minConfirmations) {
      confirmed += value;
    } else {
      unconfirmed += value;
    }
  }
  return { confirmed, unconfirmed, txids };
}

export async function checkBtcAddress(
  esploraUrl: string,
  address: string,
  minConfirmations: number,
  notBefore = 0
): Promise<ChainReceipt> {
  const base = trimSlash(esploraUrl);
  // A fresh address has few transactions: the first page (mempool + 25 confirmed) is enough
  const [tip, txs] = await Promise.all([
    getText(`${base}/blocks/tip/height`).then((h) => parseInt(h, 10)),
    getJson<EsploraTx[]>(`${base}/address/${address}/txs`),
  ]);
  if (!Number.isFinite(tip)) throw new Error('Esplora: invalid tip height');
  return sumEsploraTxs(txs, address, tip, minConfirmations, notBefore);
}
