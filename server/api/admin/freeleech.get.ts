import { requireAdminSession } from '../../utils/adminAuth';
import { getFreeleechState } from '../../utils/settings';

/**
 * GET /api/admin/freeleech
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return getFreeleechState();
});
