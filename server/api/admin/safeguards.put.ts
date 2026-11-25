import { z } from 'zod';
import { requireAdminSession } from '../../utils/adminAuth';
import { validateBody } from '../../utils/schemas';
import {
  getSlurFilterWords,
  isMultiAccountGuardEnabled,
  isSlurFilterEnabled,
  setSetting,
  SETTINGS_KEYS,
} from '../../utils/settings';

const safeguardsSchema = z.object({
  slurFilter: z.boolean().optional(),
  slurWords: z.string().max(10_000).optional(),
  multiAccountGuard: z.boolean().optional(),
});

/**
 * PUT /api/admin/safeguards
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, safeguardsSchema);

  if (body.slurFilter !== undefined) {
    await setSetting(SETTINGS_KEYS.SLUR_FILTER_ENABLED, String(body.slurFilter));
  }
  if (body.slurWords !== undefined) {
    await setSetting(SETTINGS_KEYS.SLUR_FILTER_WORDS, body.slurWords.trim());
  }
  if (body.multiAccountGuard !== undefined) {
    await setSetting(SETTINGS_KEYS.MULTI_ACCOUNT_GUARD, String(body.multiAccountGuard));
  }

  return {
    slurFilter: await isSlurFilterEnabled(),
    slurWords: await getSlurFilterWords(),
    multiAccountGuard: await isMultiAccountGuardEnabled(),
  };
});
