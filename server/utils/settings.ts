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
  SITE_LOGO_IMAGE: 'site_logo_image',
  SITE_SUBTITLE: 'site_subtitle',
  ANNOUNCEMENT_ENABLED: 'announcement_enabled',
  ANNOUNCEMENT_MESSAGE: 'announcement_message',
  ANNOUNCEMENT_TYPE: 'announcement_type',
  // Homepage content
  HERO_TITLE: 'hero_title',
  HERO_SUBTITLE: 'hero_subtitle',
  STATUS_BADGE_TEXT_ONLINE: 'status_badge_text_online',
  STATUS_BADGE_TEXT_OFFLINE: 'status_badge_text_offline',
  FEATURE_1_TITLE: 'feature_1_title',
  FEATURE_1_DESC: 'feature_1_desc',
  FEATURE_2_TITLE: 'feature_2_title',
  FEATURE_2_DESC: 'feature_2_desc',
  FEATURE_3_TITLE: 'feature_3_title',
  FEATURE_3_DESC: 'feature_3_desc',
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

/**
 * Get site logo image URL (custom uploaded image)
 */
export async function getSiteLogoImage(): Promise<string | null> {
  const value = await getSetting(SETTINGS_KEYS.SITE_LOGO_IMAGE);
  return value || null;
}

/**
 * Get site subtitle (displayed below site name)
 */
export async function getSiteSubtitle(): Promise<string | null> {
  const value = await getSetting(SETTINGS_KEYS.SITE_SUBTITLE);
  return value || null;
}

/**
 * Check if announcement is enabled
 */
export async function isAnnouncementEnabled(): Promise<boolean> {
  const value = await getSetting(SETTINGS_KEYS.ANNOUNCEMENT_ENABLED);
  return value === 'true';
}

/**
 * Get announcement message
 */
export async function getAnnouncementMessage(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.ANNOUNCEMENT_MESSAGE);
  return value || '';
}

/**
 * Get announcement type (info, warning, error)
 */
export async function getAnnouncementType(): Promise<'info' | 'warning' | 'error'> {
  const value = await getSetting(SETTINGS_KEYS.ANNOUNCEMENT_TYPE);
  if (value === 'warning' || value === 'error') return value;
  return 'info';
}

// ============================================================================
// Homepage Content
// ============================================================================

/**
 * Get hero title
 */
export async function getHeroTitle(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.HERO_TITLE);
  return value || 'OpenTracker';
}

/**
 * Get hero subtitle
 */
export async function getHeroSubtitle(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.HERO_SUBTITLE);
  return value || 'High-performance, minimalist P2P tracking engine. Search through our indexed database of verified torrents.';
}

/**
 * Get status badge text for online state
 */
export async function getStatusBadgeTextOnline(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.STATUS_BADGE_TEXT_ONLINE);
  return value || 'Tracker Online & Operational';
}

/**
 * Get status badge text for offline state
 */
export async function getStatusBadgeTextOffline(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.STATUS_BADGE_TEXT_OFFLINE);
  return value || 'Tracker Offline';
}

/**
 * Get feature 1 title
 */
export async function getFeature1Title(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.FEATURE_1_TITLE);
  return value || 'High Performance';
}

/**
 * Get feature 1 description
 */
export async function getFeature1Desc(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.FEATURE_1_DESC);
  return value || 'Built with Node.js and Redis for sub-millisecond response times and high concurrency support.';
}

/**
 * Get feature 2 title
 */
export async function getFeature2Title(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.FEATURE_2_TITLE);
  return value || 'Multi-Protocol';
}

/**
 * Get feature 2 description
 */
export async function getFeature2Desc(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.FEATURE_2_DESC);
  return value || 'Supports HTTP, UDP, and WebSocket protocols for maximum compatibility with all BitTorrent clients.';
}

/**
 * Get feature 3 title
 */
export async function getFeature3Title(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.FEATURE_3_TITLE);
  return value || 'Open Source';
}

/**
 * Get feature 3 description
 */
export async function getFeature3Desc(): Promise<string> {
  const value = await getSetting(SETTINGS_KEYS.FEATURE_3_DESC);
  return value || 'Fully transparent and community-driven. Designed for privacy and efficiency in the P2P ecosystem.';
}
