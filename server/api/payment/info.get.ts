import { getPaidRegistration } from '../../utils/settings';
import { offeredCurrencies } from '../../utils/payments/invoices';

/**
 * GET /api/payment/info
 * Public: whether sign-up is paid, and the price in each accepted coin
 */
export default defineEventHandler(async () => {
  const config = await getPaidRegistration();
  const currencies = config.enabled ? offeredCurrencies(config) : [];
  return {
    enabled: currencies.length > 0,
    invitesPay: config.invitesPay,
    pendingDays: config.pendingDays,
    options: currencies.map((currency) => ({ currency, price: config[currency].price })),
  };
});
