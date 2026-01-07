import { join } from 'path';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';

/**
 * GET /uploads/[name]
 * Serve uploaded files directly from the persistent storage
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name');

  if (!name || name.includes('..') || name.includes('/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid filename',
    });
  }

  // Path to the uploads directory in the container
  // In production, use absolute path since process.cwd() may differ after Nuxt build
  const isProduction = process.env.NODE_ENV === 'production';
  const uploadsDir = isProduction
    ? '/app/public/uploads'
    : join(process.cwd(), 'public', 'uploads');
  const filePath = join(uploadsDir, name);

  try {
    // Check if file exists and get stats
    const stats = await stat(filePath);

    if (!stats.isFile()) {
      throw createError({ statusCode: 404, statusMessage: 'File not found' });
    }

    // Set appropriate headers
    const ext = name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    };

    if (ext && mimeTypes[ext]) {
      setHeader(event, 'Content-Type', mimeTypes[ext]);
    }

    setHeader(event, 'Content-Length', stats.size);
    setHeader(event, 'Cache-Control', 'public, max-age=86400, immutable');

    // Serve file stream
    return sendStream(event, createReadStream(filePath));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found',
      });
    }
    throw error;
  }
});
