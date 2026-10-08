import { describe, expect, it } from 'vitest';
import { isThemePreference } from '../app/composables/useTheme';

describe('isThemePreference', () => {
  it('accepts the three known values', () => {
    expect(['system', 'light', 'dark'].every(isThemePreference)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const value of ['blue', '', 'Dark', undefined, null, 1]) {
      expect(isThemePreference(value)).toBe(false);
    }
  });
});
