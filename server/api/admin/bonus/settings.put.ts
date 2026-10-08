import { z } from 'zod';
import { requireAdminSession } from '../../../utils/adminAuth';
import { validateBody } from '../../../utils/schemas';
import { SETTINGS_KEYS, getBonusSettings, setSetting } from '../../../utils/settings';

const bonusSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  pointsPerSeedDay: z.number().min(0).max(100000).optional(),
  maxSeedingTorrents: z.number().int().min(0).max(10000).optional(),
  pointsPerUpload: z.number().min(0).max(100000).optional(),
  bountyMinPoints: z.number().int().min(1).max(1000000).optional(),
});

/**
 * PUT /api/admin/bonus/settings
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, bonusSettingsSchema);

  const map: Record<keyof typeof body, string> = {
    enabled: SETTINGS_KEYS.BONUS_ENABLED,
    pointsPerSeedDay: SETTINGS_KEYS.BONUS_POINTS_PER_SEED_DAY,
    maxSeedingTorrents: SETTINGS_KEYS.BONUS_MAX_SEEDING_TORRENTS,
    pointsPerUpload: SETTINGS_KEYS.BONUS_POINTS_PER_UPLOAD,
    bountyMinPoints: SETTINGS_KEYS.BOUNTY_MIN_POINTS,
  };

  for (const [field, key] of Object.entries(map) as [keyof typeof body, string][]) {
    const value = body[field];
    if (value !== undefined) await setSetting(key, String(value));
  }

  return getBonusSettings();
});
