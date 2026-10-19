import { requireAdminSession } from '../../utils/adminAuth';
import { setSetting, SETTINGS_KEYS } from '../../utils/settings';
import { deleteUpload, saveUpload } from '../../utils/uploads';
import { randomBytes } from 'crypto';

/**
 * POST /api/admin/logo
 * Upload a custom logo image (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const formData = await readMultipartFormData(event);
  if (!formData || formData.length === 0) {
    console.error('[Logo Upload] No form data received');
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    });
  }

  const file = formData.find((f) => f.name === 'logo');
  if (!file || !file.data) {
    console.error('[Logo Upload] No logo file found in form data');
    throw createError({
      statusCode: 400,
      statusMessage: 'No logo file found in upload',
    });
  }

  // Validate file type
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
  ];
  const mimeType = file.type || '';
  if (!allowedTypes.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid file type: ${mimeType}. Allowed: PNG, JPEG, SVG, WebP`,
    });
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File too large. Maximum size: 5MB',
    });
  }

  // Get file extension
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType] || 'png';

  // Generate unique filename
  const filename = `logo-${randomBytes(8).toString('hex')}.${ext}`;

  // Get current logo to delete old one
  const { getSiteLogoImage } = await import('../../utils/settings');
  const currentLogo = await getSiteLogoImage();

  // Save file
  await saveUpload(filename, file.data);

  // File URL (relative to public folder)
  const fileUrl = `/uploads/${filename}`;

  // Save to settings
  await setSetting(SETTINGS_KEYS.SITE_LOGO_IMAGE, fileUrl);

  // Delete old logo if it exists and is in uploads folder
  // Only delete files we generated ourselves: the setting is admin-editable
  // and a crafted value like /uploads/../../x must never reach unlink.
  const oldName = currentLogo?.startsWith('/uploads/')
    ? currentLogo.slice('/uploads/'.length)
    : null;
  if (oldName && /^(logo|favicon)-[a-f0-9]{16}\.[a-z]+$/.test(oldName)) {
    await deleteUpload(oldName).catch(() => {
      // Ignore deletion errors
    });
  }

  return {
    success: true,
    url: fileUrl,
  };
});
