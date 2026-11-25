import { requireAdminSession } from '../../utils/adminAuth';
import {
  getSlurFilterWords,
  isMultiAccountGuardEnabled,
  isSlurFilterEnabled,
} from '../../utils/settings';

/**
 * GET /api/admin/safeguards
 * Slur filter and multi-account guard settings
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return {
    slurFilter: await isSlurFilterEnabled(),
    slurWords: await getSlurFilterWords(),
    multiAccountGuard: await isMultiAccountGuardEnabled(),
  };
});
