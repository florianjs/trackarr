/**
 * Solana: payments go to the admin's address; each invoice gets a random
 * Solana Pay `reference` key that the wallet adds to the transfer, so the
 * transaction can be found with getSignaturesForAddress(reference). Only
 * native SOL transfers are counted. Final once the cluster says "finalized".
 */

import { randomBytes } from 'node:crypto';
import { base58 } from '@scure/base';
import { jsonRpc, type ChainReceipt } from './http';

export function isSolanaAddress(value: string): boolean {
  try {
    return base58.decode(value).length === 32;
  } catch {
    return false;
  }
}

/** Random 32-byte key: never on-chain before, unique to one invoice */
export function newSolReference(): string {
  return base58.encode(randomBytes(32));
}

interface SignatureInfo {
  signature: string;
  err: unknown;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
}

export interface SolanaTransaction {
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
  transaction: { message: { accountKeys: (string | { pubkey: string })[] } };
}

/** Lamports `recipient` gained in one transaction (0 if failed or absent) */
export function solanaCredit(tx: SolanaTransaction, recipient: string): bigint {
  if (!tx.meta || tx.meta.err) return 0n;
  // Account order: static keys, then loaded writable, then loaded readonly
  const keys = [
    ...tx.transaction.message.accountKeys.map((k) => (typeof k === 'string' ? k : k.pubkey)),
    ...(tx.meta.loadedAddresses?.writable ?? []),
    ...(tx.meta.loadedAddresses?.readonly ?? []),
  ];
  const i = keys.indexOf(recipient);
  if (i < 0) return 0n;
  const delta = BigInt(tx.meta.postBalances[i] ?? 0) - BigInt(tx.meta.preBalances[i] ?? 0);
  return delta > 0n ? delta : 0n;
}

export async function checkSolReference(
  rpcUrl: string,
  recipient: string,
  reference: string
): Promise<ChainReceipt> {
  const signatures = await jsonRpc<SignatureInfo[]>(rpcUrl, 'getSignaturesForAddress', [
    reference,
    { limit: 20, commitment: 'confirmed' },
  ]);
  let confirmed = 0n;
  let unconfirmed = 0n;
  const txids: string[] = [];
  for (const info of signatures) {
    if (info.err) continue;
    const tx = await jsonRpc<SolanaTransaction | null>(rpcUrl, 'getTransaction', [
      info.signature,
      { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx) continue;
    const credit = solanaCredit(tx, recipient);
    if (credit === 0n) continue;
    txids.push(info.signature);
    if (info.confirmationStatus === 'finalized') confirmed += credit;
    else unconfirmed += credit;
  }
  return { confirmed, unconfirmed, txids };
}
