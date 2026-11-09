import { requireUploader } from '../../utils/uploaderAuth';
import { rateLimit } from '../../utils/rateLimit';
import { detectImage } from '../../utils/imageType';
import { uploadToPixhost } from '../../utils/pixhost';

// Pixhost refuses images over 10 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/upload-assistant/screenshot
 * Relay one screenshot to Pixhost for the web assistant: the page's CSP only
 * lets the browser talk to this site. Multipart: `image` (JPEG/PNG/WebP) and
 * `adult` ("1" for NSFW content, so Pixhost files it accordingly).
 */
export default defineEventHandler(async (event) => {
  await requireUploader(event);
  await rateLimit(event, { windowSec: 60, maxRequests: 30, prefix: 'shot' });

  const contentLength = Number(getHeader(event, 'content-length') || 0);
  if (!contentLength) throw createError({ statusCode: 411, message: 'Content-Length required' });
  if (contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    throw createError({ statusCode: 413, message: 'Screenshot too large (max 10 MB)' });
  }

  const form = await readMultipartFormData(event);
  const image = form?.find((f) => f.name === 'image');
  if (!image?.data?.length) throw createError({ statusCode: 400, message: 'No image' });
  if (image.data.length > MAX_IMAGE_BYTES) {
    throw createError({ statusCode: 413, message: 'Screenshot too large (max 10 MB)' });
  }
  const kind = detectImage(image.data);
  if (!kind || !['jpeg', 'png', 'webp'].includes(kind.kind)) {
    throw createError({ statusCode: 400, message: 'Screenshots must be JPEG, PNG or WebP' });
  }
  const adult = form?.find((f) => f.name === 'adult')?.data.toString() === '1';

  try {
    return await uploadToPixhost(image.data, `screenshot.${kind.ext}`, adult);
  } catch (err) {
    console.error('[Upload assistant] Pixhost upload failed:', (err as Error).message);
    throw createError({ statusCode: 502, message: 'The image host refused the screenshot, try again' });
  }
});
