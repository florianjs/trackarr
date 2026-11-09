import { z } from 'zod';
import { validateBody } from '../../utils/schemas';
import { protectEndpoint } from '../../utils/rateLimit';
import { getPaidRegistration } from '../../utils/settings';
import { openInvoice } from '../../utils/payments/invoices';
import { paymentStatus, requirePaymentSession } from '../../utils/payments/userStatus';
import { PAYMENT_CURRENCIES } from '../../../shared/utils/paidRegistration';

const bodySchema = z.object({ currency: z.enum(PAYMENT_CURRENCIES) });

/**
 * POST /api/payment/invoice
 * Get (or create) the locked account's invoice for one coin
 */
export default defineEventHandler(async (event) => {
  await protectEndpoint(event, 'mutation');
  const session = await requirePaymentSession(event);
  if (!event.context.authUser?.paymentPending) {
    throw createError({ statusCode: 400, message: 'This account is already active' });
  }
  const { currency } = await validateBody(event, bodySchema);

  try {
    await openInvoice(session.user.id, currency, await getPaidRegistration());
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    console.error(`[Payments] Could not create ${currency} invoice:`, (err as Error).message);
    throw createError({ statusCode: 503, message: 'Payment backend unavailable, try again later' });
  }
  return paymentStatus(session.user.id);
});
