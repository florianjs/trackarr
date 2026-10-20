import { randomBytes } from 'crypto';
import { requireAdminSession } from '../../../utils/adminAuth';
import { getAppearance, setAppearance } from '../../../utils/settings';
import { deleteUpload, saveUpload } from '../../../utils/uploads';
import { detectImage } from '../../../utils/imageType';
import {
  APPEARANCE_IMAGE_RE,
  APPEARANCE_IMAGE_SLOTS,
  type Appearance,
  type AppearanceImageSlot,
} from '../../../../shared/utils/appearance';

const MAX_SIZE = 8 * 1024 * 1024;

function slotValue(a: Appearance, slot: AppearanceImageSlot): string | null {
  return slot === 'loginImage' ? a.login.image : a.images.homeBanner;
}

function withSlot(a: Appearance, slot: AppearanceImageSlot, url: string | null): Appearance {
  return slot === 'loginImage'
    ? { ...a, login: { ...a.login, image: url } }
    : { ...a, images: { ...a.images, homeBanner: url } };
}

/**
 * POST /api/admin/appearance/image
 * Multipart: `slot` (loginImage | homeBanner) and `image` (PNG, JPEG or WebP,
 * 8 MB max). Without `image`, clears the slot. The previous file is deleted.
 * Returns the stored appearance.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const form = (await readMultipartFormData(event)) ?? [];
  const slot = form.find((f) => f.name === 'slot')?.data.toString('utf8');
  if (!APPEARANCE_IMAGE_SLOTS.includes(slot as AppearanceImageSlot)) {
    throw createError({ statusCode: 400, message: 'Invalid image slot' });
  }
  const typedSlot = slot as AppearanceImageSlot;

  let url: string | null = null;
  const file = form.find((f) => f.name === 'image');
  if (file?.data?.length) {
    if (file.data.length > MAX_SIZE) {
      throw createError({ statusCode: 400, message: 'File too large. Maximum size: 8MB' });
    }
    // Magic bytes, not the declared type: SVG and GIF are refused
    const image = detectImage(file.data);
    if (!image || image.kind === 'gif') {
      throw createError({ statusCode: 400, message: 'Invalid image. Allowed: PNG, JPEG, WebP' });
    }
    const name = `appearance-${randomBytes(8).toString('hex')}.${image.ext}`;
    await saveUpload(name, file.data);
    url = `/uploads/${name}`;
  }

  const current = await getAppearance();
  const previous = slotValue(current, typedSlot);
  const next = withSlot(current, typedSlot, url);
  await setAppearance(next);

  // Only files this endpoint created (the pattern is validated on read too)
  if (previous && previous !== url && APPEARANCE_IMAGE_RE.test(previous)) {
    await deleteUpload(previous.slice('/uploads/'.length)).catch((err) => {
      console.error('[Appearance] Failed to delete old image:', err);
    });
  }

  return next;
});
