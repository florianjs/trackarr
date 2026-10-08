import {
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
} from '../utils/settings';
import { sanitizeRichText } from '../utils/sanitize';

/**
 * GET /api/branding
 * Public endpoint for site branding (no auth required)
 */
export default defineEventHandler(async () => {
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

  // Rich text fields are rendered with v-html: sanitize on the way out so
  // values stored before sanitization was added are covered too.
  return {
    siteName: sanitizeRichText(siteName),
    siteLogo,
    siteLogoImage,
    siteFavicon,
    siteSubtitle: sanitizeRichText(siteSubtitle),
    siteNameColor,
    siteNameBold,
    authTitle: sanitizeRichText(authTitle),
    authSubtitle: sanitizeRichText(authSubtitle),
    footerText: sanitizeRichText(footerText),
    pageTitleSuffix, // Rendered as text in <title>, never as HTML
  };
});
