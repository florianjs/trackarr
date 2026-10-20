import { requireAdminSession } from '../../../utils/adminAuth';
import { getAppearance, setAppearance } from '../../../utils/settings';
import { getLocaleSource } from '../../../utils/localeSource';
import { validateBody } from '../../../utils/schemas';
import { appearanceSchema, keepTextOverrides } from '../../../../shared/utils/appearance';

/**
 * PUT /api/admin/appearance
 * Save theme, fonts, login layout and text overrides (admin only). Images are
 * set by POST /api/admin/appearance/image, so the stored ones are kept.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, appearanceSchema);

  const texts: typeof body.texts = {};
  for (const [locale, overrides] of Object.entries(body.texts) as [keyof typeof body.texts, Record<string, string>][]) {
    const kept = keepTextOverrides(overrides, await getLocaleSource(locale));
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
