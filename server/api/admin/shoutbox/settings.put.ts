import { z } from 'zod';
import { requireAdminSession } from '../../../utils/adminAuth';
import { validateBody } from '../../../utils/schemas';
import { SETTINGS_KEYS, isShoutboxEnabled, setSetting } from '../../../utils/settings';

const settingsSchema = z.object({ enabled: z.boolean() });

/**
 * PUT /api/admin/shoutbox/settings
 * Turn the whole shoutbox on or off
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const { enabled } = await validateBody(event, settingsSchema);
  await setSetting(SETTINGS_KEYS.SHOUTBOX_ENABLED, String(enabled));
  return { enabled: await isShoutboxEnabled() };
});
