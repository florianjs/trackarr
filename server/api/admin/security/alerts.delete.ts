import { requireAdminSession } from '../../../utils/adminAuth';
import { clearSecurityAlerts } from '../../../utils/alerts';

/**
 * DELETE /api/admin/security/alerts
 * Clear the alert list (webhooks already received theirs)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  await clearSecurityAlerts();
  return { success: true };
});
