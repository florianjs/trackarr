import { z } from 'zod';
import { requireAdminSession } from '../../utils/adminAuth';
import { validateBody } from '../../utils/schemas';
import {
  SETTINGS_KEYS,
  deleteSetting,
  getFooterLinks,
  getFooterTagline,
  setSetting,
} from '../../utils/settings';
import { parseFooterLinks } from '../../../shared/utils/footerLinks';

const footerSchema = z.object({
  links: z.array(z.unknown()).optional(),
  // null resets to the default text, '' hides it
  tagline: z.string().max(100).nullable().optional(),
});

/**
 * PUT /api/admin/footer
 * Footer links (icon, label, url) and tagline
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, footerSchema);

  if (body.links !== undefined) {
    const links = parseFooterLinks(body.links);
    if (!links) {
      throw createError({
        statusCode: 400,
        message: 'Invalid footer links (unknown icon, or URL not http(s)/mailto)',
      });
    }
    await setSetting(SETTINGS_KEYS.FOOTER_LINKS, JSON.stringify(links));
  }

  if (body.tagline !== undefined) {
    if (body.tagline === null) {
      // Back to the default translated text
      await deleteSetting(SETTINGS_KEYS.FOOTER_TAGLINE);
    } else {
      await setSetting(SETTINGS_KEYS.FOOTER_TAGLINE, body.tagline.trim());
    }
  }

  const [links, tagline] = await Promise.all([getFooterLinks(), getFooterTagline()]);
  return { links, tagline };
});
