import { z } from 'zod';
import { requireAdminSession } from '../../../utils/adminAuth';
import { validateBody } from '../../../utils/schemas';
import { getPaidRegistration, setPaidRegistration } from '../../../utils/settings';
import { deriveBtcAddress } from '../../../utils/payments/btc';
import { isSolanaAddress } from '../../../utils/payments/sol';
import {
  isValidPrice,
  parsePaidRegistration,
  type PaymentCurrency,
} from '../../../../shared/utils/paidRegistration';

const price = z.string().trim().max(32);
const url = z.union([z.literal(''), z.url().max(500)]);

const bodySchema = z.object({
  enabled: z.boolean(),
  invitesPay: z.boolean(),
  pendingDays: z.number().int().min(1).max(365),
  btc: z.object({
    enabled: z.boolean(),
    price,
    xpub: z.string().trim().max(200),
    confirmations: z.number().int().min(0).max(100),
    esploraUrl: url,
  }),
  xmr: z.object({
    enabled: z.boolean(),
    price,
    confirmations: z.number().int().min(0).max(100),
  }),
  sol: z.object({
    enabled: z.boolean(),
    price,
    address: z.string().trim().max(64),
    rpcUrl: url,
  }),
});

function invalid(message: string): never {
  throw createError({ statusCode: 400, message });
}

/**
 * PUT /api/admin/payments/settings
 * A coin switched on must be fully usable: valid price and receiving side
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, bodySchema);

  for (const currency of ['btc', 'xmr', 'sol'] as PaymentCurrency[]) {
    const coin = body[currency];
    if (coin.enabled && !isValidPrice(coin.price, currency)) {
      invalid(`Invalid ${currency.toUpperCase()} price`);
    }
  }
  if (body.btc.enabled || body.btc.xpub) {
    try {
      deriveBtcAddress(body.btc.xpub, 0);
    } catch (err) {
      invalid(`Bitcoin key: ${(err as Error).message}`);
    }
  }
  if ((body.sol.enabled || body.sol.address) && !isSolanaAddress(body.sol.address)) {
    invalid('Invalid Solana address');
  }

  await setPaidRegistration(parsePaidRegistration(body));
  return { config: await getPaidRegistration() };
});
