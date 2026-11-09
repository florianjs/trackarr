import { redis } from '../../redis/client';
import { claim } from '../../redis/claim';
import { getPaidRegistration } from '../../utils/settings';
import { listUserInvoices, refreshInvoice } from '../../utils/payments/invoices';
import { paymentStatus, requirePaymentSession } from '../../utils/payments/userStatus';

/**
 * POST /api/payment/check
 * "I have paid": read the chain now instead of waiting for the watcher.
 * At most once every 20 s per account (public chain APIs rate-limit).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePaymentSession(event);
  const userId = session.user.id;

  if (event.context.authUser?.paymentPending && (await claim(redis, `payment-check:${userId}`, 20_000))) {
    const config = await getPaidRegistration();
    for (const invoice of await listUserInvoices(userId)) {
      try {
        const updated = await refreshInvoice(invoice, config);
        if (updated.status === 'paid') break;
      } catch (err) {
        console.error(`[Payments] Check failed for invoice ${invoice.id}:`, (err as Error).message);
      }
    }
  }
  return paymentStatus(userId);
});
