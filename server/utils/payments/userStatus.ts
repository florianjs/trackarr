import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { getPaidRegistration } from '../settings';
import { requireAuthSession } from '../adminAuth';
import { invoiceView, listUserInvoices, offeredCurrencies } from './invoices';

/** Signed-in account, locked or not: the payment endpoints serve both */
export async function requirePaymentSession(event: H3Event) {
  return requireAuthSession(event, { allowPaymentPending: true });
}

/** Everything the payment page needs for one account */
export async function paymentStatus(userId: string) {
  const config = await getPaidRegistration();
  const [user] = await db
    .select({ paymentPending: users.paymentPending, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw createError({ statusCode: 404, message: 'Account not found' });

  const invoices = await listUserInvoices(userId);
  return {
    paymentPending: user.paymentPending,
    // Unpaid accounts on which nothing arrived are deleted after this date
    deadline: new Date(user.createdAt.getTime() + config.pendingDays * 86_400_000),
    options: offeredCurrencies(config).map((currency) => ({
      currency,
      price: config[currency].price,
      confirmations: currency === 'sol' ? null : config[currency].confirmations,
    })),
    invoices: invoices.map(invoiceView),
  };
}
