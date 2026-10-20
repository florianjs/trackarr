import { getAppearance } from '../utils/settings';

/**
 * GET /api/appearance
 * Public: theme, fonts, login design, images and text overrides, applied on
 * every page including the login page (no auth required)
 */
export default defineEventHandler(async () => {
  return getAppearance();
});
