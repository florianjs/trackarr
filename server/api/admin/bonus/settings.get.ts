import { requireAdminSession } from '../../../utils/adminAuth';
import { getBonusSettings } from '../../../utils/settings';

/**
 * GET /api/admin/bonus/settings
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return getBonusSettings();
});
