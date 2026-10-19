import { getPublicStats } from '../../utils/publicStats';

/**
 * GET /api/stats/public
 * Site-wide numbers for the home page (cached 5 minutes)
 */
export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  return getPublicStats();
});
