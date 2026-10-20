import { z } from 'zod';
import { requireAdminSession } from '../../../utils/adminAuth';
import { getLocaleSource } from '../../../utils/localeSource';
import { APPEARANCE_LOCALES } from '../../../../shared/utils/appearance';

const querySchema = z.object({ locale: z.enum(APPEARANCE_LOCALES) });

/**
 * GET /api/admin/appearance/texts?locale=fr
 * Shipped translations of a locale, flat, for the admin text editor
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const { locale } = await getValidatedQuery(event, querySchema.parse);
  return getLocaleSource(locale);
});
