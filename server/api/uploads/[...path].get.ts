import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { sendStream, setHeader, createError } from 'h3';

/**
 * GET /api/uploads/[...path]
 * Serve uploaded files from /app/data/uploads in production
 * In development, files are served directly from public/uploads
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path');
  
  if (!path) {
    throw createError({
      statusCode: 400,
      message: 'File path required',
    });
  }

  // Prevent directory traversal attacks
  if (path.includes('..') || path.includes('~')) {
    throw createError({
      statusCode: 400,
      message: 'Invalid file path',
    });
  }

  // Determine base directory
  const isProduction = process.env.NODE_ENV === 'production';
  const baseDir = isProduction 
    ? '/app/data/uploads'
    : join(process.cwd(), 'public', 'uploads');
  
  const filePath = join(baseDir, path);

  // Check file exists and is within the uploads directory
  if (!existsSync(filePath)) {
    throw createError({
      statusCode: 404,
      message: 'File not found',
    });
  }

  // Ensure we're not serving a directory
  const stats = statSync(filePath);
  if (stats.isDirectory()) {
    throw createError({
      statusCode: 400,
      message: 'Cannot serve directory',
    });
  }

  // Set content type based on extension
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'gif': 'image/gif',
  };
  
  const contentType = mimeTypes[ext || ''] || 'application/octet-stream';
  setHeader(event, 'Content-Type', contentType);
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
  
  return sendStream(event, createReadStream(filePath));
});
