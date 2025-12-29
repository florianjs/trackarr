import { getSiteName, getSiteLogo } from '../utils/settings';

/**
 * GET /api/branding
 * Public endpoint for site branding (no auth required)
 */
export default defineEventHandler(async () => {
  const siteName = await getSiteName();
  const siteLogo = await getSiteLogo();

  return {
    siteName,
    siteLogo,
  };
});
