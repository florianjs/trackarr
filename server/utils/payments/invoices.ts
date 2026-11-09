/**
 * Registration invoices: one per (account, coin), with its own receiving
 * address or reference. The amount is locked when the invoice is created, so
 * a later price change does not affect it. Once enough is confirmed on-chain
 * the account is unlocked (users.payment_pending = false).
 */

import { and, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { invitations, registrationPayments, users } from '../../db/schema';
import {
  availableCurrencies,
  fromAtomic,
  invoiceStatus,
  toAtomic,
  type PaidRegistrationConfig,
  paymentUri,
  type PaymentCurrency,
} from '../../../shared/utils/paidRegistration';
import type { ChainReceipt } from './http';
import { checkBtcAddress, deriveBtcAddress } from './btc';
import { checkXmrSubaddress, createXmrSubaddress, moneroRpcUrl } from './xmr';
import { checkSolReference, newSolReference } from './sol';

export type RegistrationPayment = typeof registrationPayments.$inferSelect;

// Serializes BTC index allocation across requests and nodes
const BTC_INDEX_LOCK_ID = 7_202_611;

const OPEN_STATUSES = ['pending', 'confirming'] as const;

/** Coins a new account can pay with right now */
export function offeredCurrencies(config: PaidRegistrationConfig): PaymentCurrency[] {
  return availableCurrencies(config).filter((c) => c !== 'xmr' || moneroRpcUrl() !== null);
}

export async function listUserInvoices(userId: string): Promise<RegistrationPayment[]> {
  return db
    .select()
    .from(registrationPayments)
    .where(eq(registrationPayments.userId, userId))
    .orderBy(registrationPayments.createdAt);
}

/** The user's invoice for this coin, created on first request */
export async function openInvoice(
  userId: string,
  currency: PaymentCurrency,
  config: PaidRegistrationConfig
): Promise<RegistrationPayment> {
  const [existing] = await db
    .select()
    .from(registrationPayments)
    .where(
      and(
        eq(registrationPayments.userId, userId),
        eq(registrationPayments.currency, currency),
        inArray(registrationPayments.status, [...OPEN_STATUSES])
      )
    )
    .limit(1);
  if (existing) return existing;

  if (!offeredCurrencies(config).includes(currency)) {
    throw createError({ statusCode: 400, message: 'This currency is not accepted' });
  }

  const id = crypto.randomUUID();
  const amount = toAtomic(config[currency].price, currency).toString();

  if (currency === 'btc') {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${BTC_INDEX_LOCK_ID})`);
      const [row] = await tx
        .select({ next: sql<number>`coalesce(max(${registrationPayments.btcIndex}), -1) + 1` })
        .from(registrationPayments);
      const btcIndex = Number(row?.next ?? 0);
      const address = deriveBtcAddress(config.btc.xpub, btcIndex);
      const [created] = await tx
        .insert(registrationPayments)
        .values({ id, userId, currency, address, btcIndex, amount })
        .returning();
      return created!;
    });
  }

  if (currency === 'xmr') {
    const sub = await createXmrSubaddress(`trackarr:${userId}`);
    const [created] = await db
      .insert(registrationPayments)
      .values({ id, userId, currency, address: sub.address, xmrIndex: sub.index, amount })
      .returning();
    return created!;
  }

  const [created] = await db
    .insert(registrationPayments)
    .values({
      id,
      userId,
      currency,
      address: config.sol.address,
      solReference: newSolReference(),
      amount,
    })
    .returning();
  return created!;
}

async function readChain(
  invoice: RegistrationPayment,
  config: PaidRegistrationConfig
): Promise<ChainReceipt> {
  // Only money sent for this invoice: block timestamps may lag up to 2 h
  const notBefore = Math.floor(invoice.createdAt.getTime() / 1000) - 7200;
  switch (invoice.currency as PaymentCurrency) {
    case 'btc':
      return checkBtcAddress(
        config.btc.esploraUrl,
        invoice.address,
        config.btc.confirmations,
        notBefore
      );
    case 'xmr':
      if (invoice.xmrIndex === null) throw new Error('Invoice has no subaddress index');
      return checkXmrSubaddress(invoice.xmrIndex, config.xmr.confirmations, notBefore);
    case 'sol':
      if (!invoice.solReference) throw new Error('Invoice has no reference');
      return checkSolReference(config.sol.rpcUrl, invoice.address, invoice.solReference);
    default:
      throw new Error(`Unknown currency: ${invoice.currency}`);
  }
}

/**
 * Unlock the account and close its invoices. `invoiceId` is marked paid, the
 * user's other open invoices are cancelled. Idempotent.
 */
export async function activateAccount(
  userId: string,
  invoiceId: string | null,
  approvedBy: string | null = null
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    if (invoiceId) {
      await tx
        .update(registrationPayments)
        .set({ status: 'paid', paidAt: now, approvedBy })
        .where(eq(registrationPayments.id, invoiceId));
    }
    await tx
      .update(registrationPayments)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(registrationPayments.userId, userId),
          inArray(registrationPayments.status, [...OPEN_STATUSES])
        )
      );
    await tx.update(users).set({ paymentPending: false }).where(eq(users.id, userId));
  });
}

/** Read the chain for one open invoice, store the amounts, unlock if paid */
export async function refreshInvoice(
  invoice: RegistrationPayment,
  config: PaidRegistrationConfig
): Promise<RegistrationPayment> {
  if (!(OPEN_STATUSES as readonly string[]).includes(invoice.status)) return invoice;

  const receipt = await readChain(invoice, config);
  const status = invoiceStatus(BigInt(invoice.amount), receipt.confirmed, receipt.unconfirmed);
  const [updated] = await db
    .update(registrationPayments)
    .set({
      received: receipt.confirmed.toString(),
      unconfirmed: receipt.unconfirmed.toString(),
      txids: receipt.txids,
      checkedAt: new Date(),
      // 'paid' is written by activateAccount, with the account, in one transaction
      ...(status !== 'paid' && { status }),
    })
    .where(eq(registrationPayments.id, invoice.id))
    .returning();

  if (status === 'paid') {
    await activateAccount(invoice.userId, invoice.id);
    console.log(`[Payments] Account ${invoice.userId} unlocked (${invoice.currency} ${invoice.id})`);
    return { ...updated!, status: 'paid' };
  }
  return updated!;
}

/** Open invoices of accounts still locked */
export async function listOpenInvoices(): Promise<RegistrationPayment[]> {
  return db
    .select({ invoice: registrationPayments })
    .from(registrationPayments)
    .innerJoin(users, eq(users.id, registrationPayments.userId))
    .where(
      and(
        inArray(registrationPayments.status, [...OPEN_STATUSES]),
        eq(users.paymentPending, true)
      )
    )
    .then((rows) => rows.map((r) => r.invoice));
}

/**
 * Delete locked accounts older than `pendingDays` on which nothing was ever
 * seen. Accounts with money on the way are kept for an admin to settle. The
 * invite they used, if any, becomes usable again.
 *
 * `skipUserIds`: accounts whose chain check failed this cycle. Their stored
 * amounts may be stale (API outage): never delete on stale data.
 */
export async function purgeUnpaidAccounts(
  pendingDays: number,
  skipUserIds: string[] = []
): Promise<number> {
  const cutoff = new Date(Date.now() - pendingDays * 86_400_000);
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.paymentPending, true),
        lt(users.createdAt, cutoff),
        skipUserIds.length > 0 ? notInArray(users.id, skipUserIds) : undefined,
        sql`not exists (
          select 1 from ${registrationPayments}
          where ${registrationPayments.userId} = ${users.id}
            and (${registrationPayments.received} <> '0'
              or ${registrationPayments.unconfirmed} <> '0'
              or ${registrationPayments.status} in ('confirming', 'paid'))
        )`
      )
    )
    .limit(500);

  let purged = 0;
  for (const { id } of stale) {
    try {
      const deleted = await db.transaction(async (tx) => {
        // Row lock: an unlock running now waits, so the check below holds
        // until the delete (paid in the meantime means kept, invite included)
        const [locked] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, id), eq(users.paymentPending, true)))
          .for('update');
        if (!locked) return false;
        await tx
          .update(invitations)
          .set({ usedBy: null, usedAt: null })
          .where(eq(invitations.usedBy, id));
        await tx.delete(users).where(eq(users.id, id));
        return true;
      });
      if (deleted) purged++;
    } catch (err) {
      console.error(`[Payments] Could not purge unpaid account ${id}:`, (err as Error).message);
    }
  }
  return purged;
}

/** What the payment page shows for one invoice (amounts as decimal strings) */
export function invoiceView(invoice: RegistrationPayment) {
  const currency = invoice.currency as PaymentCurrency;
  const amount = BigInt(invoice.amount);
  const seen = BigInt(invoice.received) + BigInt(invoice.unconfirmed);
  const due = amount > seen ? amount - seen : 0n;
  return {
    id: invoice.id,
    currency,
    address: invoice.address,
    reference: invoice.solReference,
    amount: fromAtomic(amount, currency),
    received: fromAtomic(invoice.received, currency),
    unconfirmed: fromAtomic(invoice.unconfirmed, currency),
    due: fromAtomic(due, currency),
    status: invoice.status,
    uri: paymentUri(currency, invoice.address, fromAtomic(due > 0n ? due : amount, currency), invoice.solReference),
    txids: invoice.txids,
    createdAt: invoice.createdAt,
    checkedAt: invoice.checkedAt,
    paidAt: invoice.paidAt,
  };
}

export type InvoiceView = ReturnType<typeof invoiceView>;
