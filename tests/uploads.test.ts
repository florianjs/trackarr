import { describe, it, expect, vi } from 'vitest';

vi.mock('../server/db', () => ({ db: {}, schema: {} }));

const { uploadMimeType } = await import('../server/utils/uploads');

describe('uploadMimeType', () => {
  it('maps known image extensions', () => {
    expect(uploadMimeType('avatar-0123456789abcdef.png')).toBe('image/png');
    expect(uploadMimeType('logo-0123456789abcdef.JPG')).toBe('image/jpeg');
    expect(uploadMimeType('favicon-0123456789abcdef.ico')).toBe('image/x-icon');
    expect(uploadMimeType('logo-0123456789abcdef.svg')).toBe('image/svg+xml');
  });

  it('rejects anything else', () => {
    expect(uploadMimeType('notes.txt')).toBeUndefined();
    expect(uploadMimeType('noextension')).toBeUndefined();
    expect(uploadMimeType('.gitkeep')).toBeUndefined();
  });
});
