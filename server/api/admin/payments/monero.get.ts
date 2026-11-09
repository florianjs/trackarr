import { requireAdminSession } from '../../../utils/adminAuth';
import { moneroWalletStatus } from '../../../utils/payments/xmr';

/**
 * GET /api/admin/payments/monero
 * Whether the view-only wallet is set up and answering
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return moneroWalletStatus();
});
