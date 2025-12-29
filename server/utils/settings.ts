import { eq } from 'drizzle-orm';
import { db } from '../db';
import { settings } from '../db/schema';

export const SETTINGS_KEYS = {
  REGISTRATION_OPEN: 'registration_open',
  MIN_RATIO: 'min_ratio',
  STARTER_UPLOAD: 'starter_upload',
  HNR_ENABLED: 'hnr_enabled',
  HNR_REQUIRED_SEED_TIME: 'hnr_required_seed_time',
  HNR_GRACE_PERIOD: 'hnr_grace_period',
  INVITE_ENABLED: 'invite_enabled',
  DEFAULT_INVITES: 'default_invites',
  SITE_NAME: 'site_name',
  SITE_LOGO: 'site_logo',
} as const;

const settingsCache = new Map<
  string,
  { value: string | null; timestamp: number }
>();
const CACHE_TTL = 60000; // 1 minute cache for settings

/**
 * Get a setting value
 */
export async function getSetting(key: string): Promise<string | null> {
  const cached = settingsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  const value = result.length > 0 ? result[0].value : null;
  settingsCache.set(key, { value, timestamp: Date.now() });
  return value;
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });

  // Invalidate cache
  settingsCache.delete(key);
}

/**
 * Check if registration is open
 */
export async function isRegistrationOpen(): Promise<boolean> {
  const value = await getSetting(SETTINGS_KEYS.REGISTRATION_OPEN);
  // Default to closed if not set
  return value === 'true';
}

/**
 * Set registration status
 */
export async function setRegistrationOpen(open: boolean): Promise<void> {
  await setSetting(SETTINGS_KEYS.REGISTRATION_OPEN, open ? 'true' : 'false');
}

/**
 * Get minimum ratio requirement
 */
export async function getMinRatio(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.MIN_RATIO);
  return value ? parseFloat(value) : 0;
}

/**
 * Get starter upload credit in bytes
 */
export async function getStarterUpload(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.STARTER_UPLOAD);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Check if HnR tracking is enabled
 */
export async function isHnrEnabled(): Promise<boolean> {
  const value = await getSetting(SETTINGS_KEYS.HNR_ENABLED);
  return value === 'true';
}

/**
 * Get required seed time for HnR (in seconds, default 24h)
 */
export async function getHnrRequiredSeedTime(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.HNR_REQUIRED_SEED_TIME);
  return value ? parseInt(value, 10) : 86400;
}

/**
 * Get HnR grace period (in seconds, default 72h)
 */
export async function getHnrGracePeriod(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.HNR_GRACE_PERIOD);
  return value ? parseInt(value, 10) : 259200;
}

/**
 * Check if invitation system is enabled
 */
export async function isInviteEnabled(): Promise<boolean> {
  const value = await getSetting(SETTINGS_KEYS.INVITE_ENABLED);
  return value === 'true';
}

/**
 * Get default number of invites for new users
 */
export async function getDefaultInvites(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.DEFAULT_INVITES);
  return value ? parseInt(value, 10) : 2;
}

/**
 * Get site name (for branding)
 */
export async function getSiteName(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.SITE_NAME);
  return value || 'OpenTracker';
}

/**
 * Get site logo icon name
 */
export async function getSiteLogo(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.SITE_LOGO);
  return value || 'ph:broadcast-bold';
}
