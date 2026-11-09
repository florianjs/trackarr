/**
 * Pixhost API v2 (no key): POST https://api.pixhost.to/images with `img`,
 * `content_type` (0 safe, 1 adult) and `max_th_size`. Answers the image page
 * and a thumbnail; trackers show the thumbnail linking to the page.
 */

// PIXHOST_API_URL: tests point it at a local stand-in
const endpoint = () => process.env.PIXHOST_API_URL || 'https://api.pixhost.to/images';
const THUMB_SIZE = 350;

export interface HostedImage {
  page: string;
  thumb: string;
}

/** Only links on Pixhost domains are accepted back */
export function isPixhostUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)pixhost\.(to|cc)$|(^|\.)pixho\.st$/.test(url.hostname);
  } catch {
    return false;
  }
}

export async function uploadToPixhost(
  data: Uint8Array,
  filename: string,
  adult: boolean
): Promise<HostedImage> {
  const form = new FormData();
  form.append('img', new Blob([data as Uint8Array<ArrayBuffer>]), filename);
  form.append('content_type', adult ? '1' : '0');
  form.append('max_th_size', String(THUMB_SIZE));
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { show_url?: unknown; th_url?: unknown };
  if (!isPixhostUrl(body.show_url) || !isPixhostUrl(body.th_url)) {
    throw new Error('Unexpected response');
  }
  return { page: body.show_url, thumb: body.th_url };
}
