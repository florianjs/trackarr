import { requireAdminSession } from '../../../utils/adminAuth';
import { getAppearance, setAppearance } from '../../../utils/settings';
import { getLocaleSource } from '../../../utils/localeSource';
import { validateBody } from '../../../utils/schemas';
import { appearanceSchema } from '../../../../shared/utils/appearance';

/**
 * PUT /api/admin/appearance
 * Save theme, fonts, login layout and text overrides (admin only). Images are
 * set by POST /api/admin/appearance/image, so the stored ones are kept.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, appearanceSchema);

  // Only keys that exist in the shipped translations, and no copy of the
  // default text: an override equal to it would hide later translation fixes
  const texts: typeof body.texts = {};
  for (const [locale, overrides] of Object.entries(body.texts) as [keyof typeof body.texts, Record<string, string>][]) {
    const source = await getLocaleSource(locale);
    const kept = Object.fromEntries(
      Object.entries(overrides).filter(([key, text]) => key in source && text.trim() !== '' && text !== source[key])
    );
    if (Object.keys(kept).length > 0) texts[locale] = kept;
  }

  const current = await getAppearance();
  const appearance = {
    ...body,
    login: { layout: body.login.layout, image: current.login.image },
    images: current.images,
    texts,
  };
  await setAppearance(appearance);

  return appearance;
});
