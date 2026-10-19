import { describe, it, expect } from 'vitest';
import { russianPlural } from '../i18n/plural';

describe('russianPlural', () => {
  it('picks one | few | many', () => {
    const form = (n: number) => russianPlural(n, 3);
    expect([1, 21, 101].map(form)).toEqual([0, 0, 0]);
    expect([2, 3, 4, 22, 34].map(form)).toEqual([1, 1, 1, 1, 1]);
    expect([0, 5, 11, 12, 14, 25, 111].map(form)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it('puts zero first when the message has four forms', () => {
    const form = (n: number) => russianPlural(n, 4);
    expect([0, 1, 2, 5, 11].map(form)).toEqual([0, 1, 2, 3, 3]);
  });

  it('falls back to one | other with fewer forms', () => {
    expect(russianPlural(1, 2)).toBe(0);
    expect(russianPlural(3, 2)).toBe(1);
  });
});
