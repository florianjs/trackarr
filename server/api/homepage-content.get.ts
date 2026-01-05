import {
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
} from '../utils/settings';

/**
 * GET /api/homepage-content
 * Public endpoint returning homepage text content
 */
export default defineEventHandler(async () => {
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
    heroTitle,
    heroSubtitle,
    statusBadgeTextOnline,
    statusBadgeTextOffline,
    features: [
      { title: feature1Title, description: feature1Desc },
      { title: feature2Title, description: feature2Desc },
      { title: feature3Title, description: feature3Desc },
    ],
  };
});
