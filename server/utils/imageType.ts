/**
 * Detect image formats from their magic bytes, never from the client-declared
 * MIME type or extension.
 */

export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp';

export interface DetectedImage {
  kind: ImageKind;
  ext: 'png' | 'jpg' | 'gif' | 'webp';
  /** GIF, animated WebP or APNG */
  animated: boolean;
}

function ascii(buf: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...buf.subarray(start, start + length));
}

function isApng(buf: Uint8Array): boolean {
  // acTL chunk must appear before the first IDAT
  for (let offset = 8; offset + 8 <= buf.length; ) {
    const length =
      ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) >>> 0;
    const type = ascii(buf, offset + 4, 4);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += 12 + length;
  }
  return false;
}

export function detectImage(buf: Uint8Array): DetectedImage | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0x89 && ascii(buf, 1, 3) === 'PNG') {
    return { kind: 'png', ext: 'png', animated: isApng(buf) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: 'jpeg', ext: 'jpg', animated: false };
  }
  const head = ascii(buf, 0, 6);
  if (head === 'GIF87a' || head === 'GIF89a') {
    return { kind: 'gif', ext: 'gif', animated: true };
  }
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') {
    // VP8X extended header: animation flag is bit 1 of the flags byte
    const animated = ascii(buf, 12, 4) === 'VP8X' && buf.length > 20 && (buf[20]! & 0x02) !== 0;
    return { kind: 'webp', ext: 'webp', animated };
  }
  return null;
}
