import { requireAdminSession } from '../../utils/adminAuth';
import {
  isRegistrationOpen,
  getMinRatio,
  getStarterUpload,
  getSiteName,
  getSiteLogo,
} from '../../utils/settings';

/**
 * GET /api/admin/settings
 * Get tracker settings (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const registrationOpen = await isRegistrationOpen();
  const minRatio = await getMinRatio();
  const starterUpload = await getStarterUpload();
  const siteName = await getSiteName();
  const siteLogo = await getSiteLogo();

  return {
    registrationOpen,
    minRatio,
    starterUpload,
    siteName,
    siteLogo,
  };
});
