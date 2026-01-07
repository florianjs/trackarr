import { requireAdminSession } from '../../utils/adminAuth';
import {
  setRegistrationOpen,
  setSetting,
  SETTINGS_KEYS,
} from '../../utils/settings';
import { validateBody, adminSettingsSchema } from '../../utils/schemas';

/**
 * PUT /api/admin/settings
 * Update tracker settings (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  // Validate request body with Zod
  const body = await validateBody(event, adminSettingsSchema);

  if (typeof body.registrationOpen === 'boolean') {
    await setRegistrationOpen(body.registrationOpen);
  }

  if (typeof body.inviteEnabled === 'boolean') {
    await setSetting(
      SETTINGS_KEYS.INVITE_ENABLED,
      body.inviteEnabled ? 'true' : 'false'
    );
  }

  if (typeof body.defaultInvites === 'number') {
    await setSetting(
      SETTINGS_KEYS.DEFAULT_INVITES,
      body.defaultInvites.toString()
    );
  }

  if (typeof body.minRatio === 'number') {
    await setSetting(SETTINGS_KEYS.MIN_RATIO, body.minRatio.toString());
  }

  if (typeof body.starterUpload === 'number') {
    await setSetting(
      SETTINGS_KEYS.STARTER_UPLOAD,
      body.starterUpload.toString()
    );
  }

  if (typeof body.siteName === 'string') {
    await setSetting(SETTINGS_KEYS.SITE_NAME, body.siteName);
  }

  if (typeof body.siteLogo === 'string') {
    await setSetting(SETTINGS_KEYS.SITE_LOGO, body.siteLogo);
  }

  if (body.siteLogoImage !== undefined) {
    if (body.siteLogoImage === null || body.siteLogoImage === '') {
      await setSetting(SETTINGS_KEYS.SITE_LOGO_IMAGE, '');
    } else {
      await setSetting(SETTINGS_KEYS.SITE_LOGO_IMAGE, body.siteLogoImage);
    }
  }

  if (body.siteSubtitle !== undefined) {
    if (body.siteSubtitle === null || body.siteSubtitle === '') {
      await setSetting(SETTINGS_KEYS.SITE_SUBTITLE, '');
    } else {
      await setSetting(SETTINGS_KEYS.SITE_SUBTITLE, body.siteSubtitle);
    }
  }

  if (body.siteNameColor !== undefined) {
    if (body.siteNameColor === null || body.siteNameColor === '') {
      await setSetting(SETTINGS_KEYS.SITE_NAME_COLOR, '');
    } else {
      await setSetting(SETTINGS_KEYS.SITE_NAME_COLOR, body.siteNameColor);
    }
  }

  if (typeof body.siteNameBold === 'boolean') {
    await setSetting(
      SETTINGS_KEYS.SITE_NAME_BOLD,
      body.siteNameBold ? 'true' : 'false'
    );
  }

  // Extended branding
  if (body.authTitle !== undefined) {
    await setSetting(SETTINGS_KEYS.AUTH_TITLE, body.authTitle || '');
  }

  if (body.authSubtitle !== undefined) {
    await setSetting(SETTINGS_KEYS.AUTH_SUBTITLE, body.authSubtitle || '');
  }

  if (body.footerText !== undefined) {
    await setSetting(SETTINGS_KEYS.FOOTER_TEXT, body.footerText || '');
  }

  if (body.pageTitleSuffix !== undefined) {
    await setSetting(
      SETTINGS_KEYS.PAGE_TITLE_SUFFIX,
      body.pageTitleSuffix || ''
    );
  }

  if (body.welcomeMessage !== undefined) {
    await setSetting(SETTINGS_KEYS.WELCOME_MESSAGE, body.welcomeMessage || '');
  }

  if (body.siteRules !== undefined) {
    await setSetting(SETTINGS_KEYS.SITE_RULES, body.siteRules || '');
  }

  if (typeof body.announcementEnabled === 'boolean') {
    await setSetting(
      SETTINGS_KEYS.ANNOUNCEMENT_ENABLED,
      body.announcementEnabled ? 'true' : 'false'
    );
  }

  if (typeof body.announcementMessage === 'string') {
    await setSetting(
      SETTINGS_KEYS.ANNOUNCEMENT_MESSAGE,
      body.announcementMessage
    );
  }

  if (typeof body.announcementType === 'string') {
    await setSetting(SETTINGS_KEYS.ANNOUNCEMENT_TYPE, body.announcementType);
  }

  // Homepage content
  if (typeof body.heroTitle === 'string') {
    await setSetting(SETTINGS_KEYS.HERO_TITLE, body.heroTitle);
  }

  if (typeof body.heroSubtitle === 'string') {
    await setSetting(SETTINGS_KEYS.HERO_SUBTITLE, body.heroSubtitle);
  }

  if (typeof body.statusBadgeText === 'string') {
    await setSetting(SETTINGS_KEYS.STATUS_BADGE_TEXT, body.statusBadgeText);
  }

  if (typeof body.feature1Title === 'string') {
    await setSetting(SETTINGS_KEYS.FEATURE_1_TITLE, body.feature1Title);
  }

  if (typeof body.feature1Desc === 'string') {
    await setSetting(SETTINGS_KEYS.FEATURE_1_DESC, body.feature1Desc);
  }

  if (typeof body.feature2Title === 'string') {
    await setSetting(SETTINGS_KEYS.FEATURE_2_TITLE, body.feature2Title);
  }

  if (typeof body.feature2Desc === 'string') {
    await setSetting(SETTINGS_KEYS.FEATURE_2_DESC, body.feature2Desc);
  }

  if (typeof body.feature3Title === 'string') {
    await setSetting(SETTINGS_KEYS.FEATURE_3_TITLE, body.feature3Title);
  }

  if (typeof body.feature3Desc === 'string') {
    await setSetting(SETTINGS_KEYS.FEATURE_3_DESC, body.feature3Desc);
  }

  return {
    success: true,
    ...body,
  };
});
