import { requireAdminSession } from '../../../utils/adminAuth';
import { getTrackerStatus } from '../../../tracker/client';

/**
 * GET /api/admin/tracker/status
 * Live state of the tracker service (null when it cannot be reached)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return { data: await getTrackerStatus() };
});
