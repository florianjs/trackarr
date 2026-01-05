import { requireAdminSession } from '../../utils/adminAuth';
import {
  isRegistrationOpen,
  getMinRatio,
  getStarterUpload,
  getSiteName,
  getSiteLogo,
  getSiteLogoImage,
  getSiteSubtitle,
  isAnnouncementEnabled,
  getAnnouncementMessage,
  getAnnouncementType,
  getHeroTitle,
  getHeroSubtitle,
  getStatusBadgeTextOnline,
  getStatusBadgeTextOffline,
  getFeature1Title,
  getFeature1Desc,
  getFeature2Title,
  getFeature2Desc,
  getFeature3Title,
  getFeature3Desc,
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
  const siteSubtitle = await getSiteSubtitle();
  const announcementEnabled = await isAnnouncementEnabled();
  const announcementMessage = await getAnnouncementMessage();
  const announcementType = await getAnnouncementType();
  const heroTitle = await getHeroTitle();
  const heroSubtitle = await getHeroSubtitle();
  const statusBadgeTextOnline = await getStatusBadgeTextOnline();
  const statusBadgeTextOffline = await getStatusBadgeTextOffline();
  const feature1Title = await getFeature1Title();
  const feature1Desc = await getFeature1Desc();
  const feature2Title = await getFeature2Title();
  const feature2Desc = await getFeature2Desc();
  const feature3Title = await getFeature3Title();
  const feature3Desc = await getFeature3Desc();

  return {
    registrationOpen,
    minRatio,
    starterUpload,
    siteName,
    siteLogo,
    siteLogoImage,
    siteSubtitle,
    announcementEnabled,
    announcementMessage,
    announcementType,
    heroTitle,
    heroSubtitle,
    statusBadgeTextOnline,
    statusBadgeTextOffline,
    feature1Title,
    feature1Desc,
    feature2Title,
    feature2Desc,
    feature3Title,
    feature3Desc,
  };
});
