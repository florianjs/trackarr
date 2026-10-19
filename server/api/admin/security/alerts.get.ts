import { requireAdminSession } from '../../../utils/adminAuth';
import { listSecurityAlerts } from '../../../utils/alerts';

/**
 * GET /api/admin/security/alerts
 * Most recent security alerts (brute force, honeypots, tracker abuse)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return { data: await listSecurityAlerts() };
});
