import { readUpload, uploadMimeType } from '../../utils/uploads';

/**
 * GET /uploads/[name]
 * Serve uploaded files from the database (legacy disk files as fallback)
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name');

  if (!name || name.includes('..') || name.includes('/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid filename',
    });
  }

  const data = await readUpload(name);
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' });
  }

  const mimeType = uploadMimeType(name);
  if (mimeType) {
    setHeader(event, 'Content-Type', mimeType);
  }

  // Uploaded SVGs can carry scripts: never let them run on our origin
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(
    event,
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
  );
  setHeader(event, 'Content-Length', data.length);
  // Names are random and never reused, so the content never changes
  setHeader(event, 'Cache-Control', 'public, max-age=86400, immutable');

  return data;
});
