import { requireAdminSession } from '../../../utils/adminAuth';
import { getPaidRegistration } from '../../../utils/settings';

/**
 * GET /api/admin/payments/settings
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return { config: await getPaidRegistration() };
});
