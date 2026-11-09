import { paymentStatus, requirePaymentSession } from '../../utils/payments/userStatus';

/**
 * GET /api/payment/status
 * The signed-in account's payment state and invoices
 */
export default defineEventHandler(async (event) => {
  const session = await requirePaymentSession(event);
  return paymentStatus(session.user.id);
});
