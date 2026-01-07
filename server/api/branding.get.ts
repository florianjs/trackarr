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
  isHtmlEmpty,
} from '../utils/settings';

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

  return {
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
  };
});
