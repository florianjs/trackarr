import { z } from 'zod';
import { requireAdminSession } from '../../../utils/adminAuth';
import { validateBody } from '../../../utils/schemas';
import {
  createViewWallet,
  isMoneroPrimaryAddress,
  isMoneroViewKey,
  moneroRpcUrl,
  moneroWalletStatus,
} from '../../../utils/payments/xmr';

const bodySchema = z.object({
  address: z.string().trim().refine(isMoneroPrimaryAddress, 'Expected the primary address (starts with 4)'),
  viewKey: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isMoneroViewKey, 'Expected the private view key: 64 hexadecimal characters'),
  restoreHeight: z.number().int().min(0).max(100_000_000),
});

/**
 * POST /api/admin/payments/monero
 * Create the view-only wallet in monero-wallet-rpc. The view key goes to the
 * wallet file only: it is not stored in the database, nor logged.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  if (!moneroRpcUrl()) {
    throw createError({ statusCode: 400, message: 'MONERO_WALLET_RPC_URL is not set' });
  }
  const body = await validateBody(event, bodySchema);

  const current = await moneroWalletStatus();
  if (current.ready) {
    throw createError({ statusCode: 409, message: 'A Monero wallet is already set up' });
  }

  try {
    await createViewWallet(body);
  } catch (err) {
    throw createError({
      statusCode: 502,
      message: `Wallet RPC refused: ${(err as Error).message}`,
    });
  }
  return moneroWalletStatus();
});
