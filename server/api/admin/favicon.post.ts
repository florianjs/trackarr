import { requireAdminSession } from '../../utils/adminAuth';
import { setSetting, SETTINGS_KEYS } from '../../utils/settings';
import { randomBytes } from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * POST /api/admin/favicon
 * Upload a custom favicon (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const formData = await readMultipartFormData(event);
  if (!formData || formData.length === 0) {
    console.error('[Favicon Upload] No form data received');
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    });
  }

  const file = formData.find((f) => f.name === 'favicon');
  if (!file || !file.data) {
    console.error('[Favicon Upload] No favicon file found in form data');
    throw createError({
      statusCode: 400,
      statusMessage: 'No favicon file found in upload',
    });
  }

  // Validate file type
  const allowedTypes = [
    'image/png',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/svg+xml',
    'image/webp',
  ];
  const mimeType = file.type || '';
  if (!allowedTypes.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid file type: ${mimeType}. Allowed: PNG, ICO, SVG, WebP`,
    });
  }

  // Validate file size (max 1MB for favicons)
  const maxSize = 1 * 1024 * 1024;
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File too large. Maximum size: 1MB',
    });
  }

  // Get file extension
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType] || 'png';

  // Generate unique filename
  const filename = `favicon-${randomBytes(8).toString('hex')}.${ext}`;

  // Ensure uploads directory exists
  const isProduction = process.env.NODE_ENV === 'production';
  const uploadsDir = isProduction
    ? '/app/public/uploads'
    : join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  // Get current favicon to delete old one
  const { getSiteFavicon } = await import('../../utils/settings');
  const currentFavicon = await getSiteFavicon();

  // Save file
  const filePath = join(uploadsDir, filename);
  await writeFile(filePath, file.data);

  // File URL (relative to public folder)
  const fileUrl = `/uploads/${filename}`;

  // Save to settings
  await setSetting(SETTINGS_KEYS.SITE_FAVICON, fileUrl);

  // Delete old favicon if it exists and is in uploads folder
  if (currentFavicon && currentFavicon.startsWith('/uploads/')) {
    const oldPath = isProduction
      ? join('/app/public', currentFavicon)
      : join(process.cwd(), 'public', currentFavicon);
    try {
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    } catch {
      // Ignore deletion errors
    }
  }

  return {
    success: true,
    url: fileUrl,
  };
});
