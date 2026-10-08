import { describe, it, expect } from 'vitest';
import { isFreeleechActive } from '../shared/utils/freeleech';

const now = new Date('2026-10-08T12:00:00Z');

describe('isFreeleechActive', () => {
  it('is off when disabled, whatever the end date', () => {
    expect(isFreeleechActive({ enabled: false, until: null }, now)).toBe(false);
    expect(isFreeleechActive({ enabled: false, until: '2099-01-01T00:00:00Z' }, now)).toBe(false);
  });

  it('runs without end date', () => {
    expect(isFreeleechActive({ enabled: true, until: null }, now)).toBe(true);
  });

  it('stops at the end date', () => {
    expect(isFreeleechActive({ enabled: true, until: '2026-10-08T13:00:00Z' }, now)).toBe(true);
    expect(isFreeleechActive({ enabled: true, until: '2026-10-08T12:00:00Z' }, now)).toBe(false);
    expect(isFreeleechActive({ enabled: true, until: '2026-10-07T00:00:00Z' }, now)).toBe(false);
  });

  it('treats an invalid end date as ended', () => {
    expect(isFreeleechActive({ enabled: true, until: 'not a date' }, now)).toBe(false);
  });
});
