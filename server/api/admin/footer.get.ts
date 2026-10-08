import { requireAdminSession } from '../../utils/adminAuth';
import { getFooterLinks, getFooterTagline } from '../../utils/settings';

/**
 * GET /api/admin/footer
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const [links, tagline] = await Promise.all([getFooterLinks(), getFooterTagline()]);
  return { links, tagline };
});
