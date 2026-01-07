import {
  getHeroTitle,
  getHeroSubtitle,
  getStatusBadgeText,
  getFeature1Title,
  getFeature1Desc,
  getFeature2Title,
  getFeature2Desc,
  getFeature3Title,
  getFeature3Desc,
  isHtmlEmpty,
} from '../utils/settings';

/**
 * GET /api/homepage-content
 * Public endpoint returning homepage text content
 * Returns null for empty fields - fallbacks handled client-side
 */
export default defineEventHandler(async () => {
  const heroTitle = await getHeroTitle();
  const heroSubtitle = await getHeroSubtitle();
  const statusBadgeText = await getStatusBadgeText();
  const feature1Title = await getFeature1Title();
  const feature1Desc = await getFeature1Desc();
  const feature2Title = await getFeature2Title();
  const feature2Desc = await getFeature2Desc();
  const feature3Title = await getFeature3Title();
  const feature3Desc = await getFeature3Desc();

  return {
    heroTitle: isHtmlEmpty(heroTitle) ? null : heroTitle,
    heroSubtitle: isHtmlEmpty(heroSubtitle) ? null : heroSubtitle,
    statusBadgeText: statusBadgeText || null,
    features: [
      {
        title: isHtmlEmpty(feature1Title) ? null : feature1Title,
        description: isHtmlEmpty(feature1Desc) ? null : feature1Desc,
      },
      {
        title: isHtmlEmpty(feature2Title) ? null : feature2Title,
        description: isHtmlEmpty(feature2Desc) ? null : feature2Desc,
      },
      {
        title: isHtmlEmpty(feature3Title) ? null : feature3Title,
        description: isHtmlEmpty(feature3Desc) ? null : feature3Desc,
      },
    ],
  };
});
