import { z } from 'zod';
import { requireAdminSession } from '../../utils/adminAuth';
import { validateBody } from '../../utils/schemas';
import { SETTINGS_KEYS, getFreeleechState, setSetting } from '../../utils/settings';

const freeleechSchema = z.object({
  enabled: z.boolean(),
  // null or omitted: no end date
  durationHours: z.number().positive().max(24 * 365).nullable().optional(),
});

/**
 * PUT /api/admin/freeleech
 * Start (for a duration or without end) or stop the global freeleech
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const { enabled, durationHours } = await validateBody(event, freeleechSchema);

  const until =
    enabled && durationHours
      ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
      : '';

  await setSetting(SETTINGS_KEYS.FREELEECH_UNTIL, until);
  await setSetting(SETTINGS_KEYS.FREELEECH_ENABLED, String(enabled));

  return getFreeleechState();
});
