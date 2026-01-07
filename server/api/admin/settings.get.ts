import { requireAdminSession } from '../../utils/adminAuth';
import {
  isRegistrationOpen,
  getMinRatio,
  getStarterUpload,
  getSiteName,
  getSiteLogo,
  getSiteLogoImage,
  getSiteFavicon,
  getSiteSubtitle,
  getSiteNameColor,
  isSiteNameBold,
  getAuthTitle,
  getAuthSubtitle,
  getFooterText,
  getPageTitleSuffix,
  getWelcomeMessage,
  getSiteRules,
  isAnnouncementEnabled,
  getAnnouncementMessage,
  getAnnouncementType,
  getHeroTitle,
  getHeroSubtitle,
  getStatusBadgeText,
  getFeature1Title,
  getFeature1Desc,
  getFeature2Title,
  getFeature2Desc,
  getFeature3Title,
  getFeature3Desc,
  isInviteEnabled,
  getDefaultInvites,
  isHtmlEmpty,
} from '../../utils/settings';

/**
 * GET /api/admin/settings
 * Get tracker settings (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const registrationOpen = await isRegistrationOpen();
  const minRatio = await getMinRatio();
  const starterUpload = await getStarterUpload();
  const siteName = await getSiteName();
  const siteLogo = await getSiteLogo();
  const siteLogoImage = await getSiteLogoImage();
  const siteFavicon = await getSiteFavicon();
  const siteSubtitle = await getSiteSubtitle();
  const siteNameColor = await getSiteNameColor();
  const siteNameBold = await isSiteNameBold();
  const authTitle = await getAuthTitle();
  const authSubtitle = await getAuthSubtitle();
  const footerText = await getFooterText();
  const pageTitleSuffix = await getPageTitleSuffix();
  const welcomeMessage = await getWelcomeMessage();
  const siteRules = await getSiteRules();
  const announcementEnabled = await isAnnouncementEnabled();
  const announcementMessage = await getAnnouncementMessage();
  const announcementType = await getAnnouncementType();
  const heroTitle = await getHeroTitle();
  const heroSubtitle = await getHeroSubtitle();
  const statusBadgeText = await getStatusBadgeText();
  const feature1Title = await getFeature1Title();
  const feature1Desc = await getFeature1Desc();
  const feature2Title = await getFeature2Title();
  const feature2Desc = await getFeature2Desc();
  const feature3Title = await getFeature3Title();
  const feature3Desc = await getFeature3Desc();
  const inviteEnabled = await isInviteEnabled();
  const defaultInvites = await getDefaultInvites();

  return {
    registrationOpen,
    minRatio,
    starterUpload,
    siteName: isHtmlEmpty(siteName) ? null : siteName,
    siteLogo,
    siteLogoImage,
    siteFavicon,
    siteSubtitle: isHtmlEmpty(siteSubtitle) ? null : siteSubtitle,
    siteNameColor,
    siteNameBold,
    authTitle: isHtmlEmpty(authTitle) ? null : authTitle,
    authSubtitle: isHtmlEmpty(authSubtitle) ? null : authSubtitle,
    footerText: isHtmlEmpty(footerText) ? null : footerText,
    pageTitleSuffix,
    welcomeMessage: isHtmlEmpty(welcomeMessage) ? null : welcomeMessage,
    siteRules: isHtmlEmpty(siteRules) ? null : siteRules,
    announcementEnabled,
    announcementMessage,
    announcementType,
    heroTitle: isHtmlEmpty(heroTitle) ? null : heroTitle,
    heroSubtitle: isHtmlEmpty(heroSubtitle) ? null : heroSubtitle,
    statusBadgeText: statusBadgeText || null,
    feature1Title: isHtmlEmpty(feature1Title) ? null : feature1Title,
    feature1Desc: isHtmlEmpty(feature1Desc) ? null : feature1Desc,
    feature2Title: isHtmlEmpty(feature2Title) ? null : feature2Title,
    feature2Desc: isHtmlEmpty(feature2Desc) ? null : feature2Desc,
    feature3Title: isHtmlEmpty(feature3Title) ? null : feature3Title,
    feature3Desc: isHtmlEmpty(feature3Desc) ? null : feature3Desc,
    inviteEnabled,
    defaultInvites,
  };
});
