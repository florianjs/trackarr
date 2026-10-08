import { describe, it, expect } from 'vitest';
import { detectImage } from '../server/utils/imageType';

function png(chunks: string[]): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = chunks.map((type) => {
    const len = Buffer.alloc(4);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), Buffer.alloc(4)]);
  });
  return Buffer.concat([sig, ...parts]);
}

function webp(animated: boolean): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b[20] = animated ? 0x02 : 0x00;
  return b;
}

describe('detectImage', () => {
  it('detects static formats', () => {
    expect(detectImage(png(['IHDR', 'IDAT', 'IEND']))).toEqual({ kind: 'png', ext: 'png', animated: false });
    expect(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(10).fill(0)]))?.kind).toBe('jpeg');
    expect(detectImage(webp(false))).toEqual({ kind: 'webp', ext: 'webp', animated: false });
  });

  it('flags animated formats', () => {
    expect(detectImage(Buffer.from('GIF89a......', 'ascii'))?.animated).toBe(true);
    expect(detectImage(png(['IHDR', 'acTL', 'IDAT']))?.animated).toBe(true);
    expect(detectImage(webp(true))?.animated).toBe(true);
  });

  it('rejects anything else, whatever the declared type', () => {
    expect(detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(detectImage(Buffer.from('short'))).toBeNull();
  });
});
