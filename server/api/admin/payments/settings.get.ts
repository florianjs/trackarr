import { requireAdminSession } from '../../../utils/adminAuth';
import { getPaidRegistration } from '../../../utils/settings';
import { moneroRpcUrl } from '../../../utils/payments/xmr';

/**
 * GET /api/admin/payments/settings
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return {
    config: await getPaidRegistration(),
    // Set in the environment, not here: shown so the admin knows XMR can work
    moneroRpcConfigured: moneroRpcUrl() !== null,
  };
});
