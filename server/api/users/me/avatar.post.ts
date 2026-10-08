import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { detectImage } from '../../../utils/imageType';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import { getUploadsDir, removeAvatarFile } from '../../../utils/uploadsDir';

const MAX_STATIC_BYTES = 512 * 1024;
const MAX_ANIMATED_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/users/me/avatar
 * Upload the current user's avatar. Animated images (GIF, animated WebP,
 * APNG) require the GIF avatar item from the bonus shop (issue #48).
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  await rateLimit(event, RATE_LIMITS.mutation);

  const contentLength = Number(getHeader(event, 'content-length') || 0);
  if (!contentLength || contentLength > MAX_ANIMATED_BYTES + 64 * 1024) {
    throw createError({ statusCode: 413, message: 'File too large (max 2MB)' });
  }

  const formData = await readMultipartFormData(event);
  const file = formData?.find((f) => f.name === 'avatar');
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: 'No avatar file uploaded' });
  }

  const image = detectImage(file.data);
  if (!image) {
    throw createError({
      statusCode: 400,
      message: 'Unsupported image. Allowed: PNG, JPEG, WebP, GIF',
    });
  }

  const account = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { avatarUrl: true, canUseGifAvatar: true },
  });

  if (image.animated && !account?.canUseGifAvatar) {
    throw createError({
      statusCode: 403,
      message: 'Animated avatars must be unlocked in the bonus shop',
    });
  }

  const maxBytes = image.animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES;
  if (file.data.length > maxBytes) {
    throw createError({
      statusCode: 413,
      message: `File too large (max ${maxBytes / 1024}KB)`,
    });
  }

  const uploadsDir = getUploadsDir();
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const filename = `avatar-${randomBytes(8).toString('hex')}.${image.ext}`;
  await writeFile(join(uploadsDir, filename), file.data);

  const avatarUrl = `/uploads/${filename}`;
  await db
    .update(schema.users)
    .set({ avatarUrl })
    .where(eq(schema.users.id, user.id));

  await removeAvatarFile(account?.avatarUrl);

  return { avatarUrl };
});
