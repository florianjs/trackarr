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
} from '../utils/settings';
import { sanitizeRichText } from '../utils/sanitize';

/**
 * GET /api/homepage-content
 * Public endpoint returning homepage text content
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

  // Rendered with v-html for anonymous visitors: sanitize on the way out
  return {
    heroTitle: sanitizeRichText(heroTitle),
    heroSubtitle: sanitizeRichText(heroSubtitle),
    statusBadgeText,
    features: [
      { title: sanitizeRichText(feature1Title), description: sanitizeRichText(feature1Desc) },
      { title: sanitizeRichText(feature2Title), description: sanitizeRichText(feature2Desc) },
      { title: sanitizeRichText(feature3Title), description: sanitizeRichText(feature3Desc) },
    ],
  };
});
