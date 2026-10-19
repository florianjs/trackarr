import { requireAdminSession } from '../../../utils/adminAuth';
import { isShoutboxEnabled } from '../../../utils/settings';

/**
 * GET /api/admin/shoutbox/settings
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return { enabled: await isShoutboxEnabled() };
});
