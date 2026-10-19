import { describe, it, expect } from 'vitest';
import { formatSize } from '../app/utils/format';

describe('formatSize', () => {
  it('picks the largest fitting unit', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(5 * 1024 ** 4)).toBe('5.0 TB');
  });

  it('goes up to petabytes and beyond', () => {
    expect(formatSize(133.35 * 1024 ** 5)).toBe('133.3 PB');
    expect(formatSize(2 * 1024 ** 7)).toBe('2048.0 EB');
  });
});
