import { describe, it, expect } from 'vitest';
import { sessionSecretProblem } from '../../server/utils/sessionSecret';

describe('sessionSecretProblem', () => {
  it('accepts a long random value', () => {
    expect(sessionSecretProblem('a'.repeat(31) + 'b')).toBeNull();
  });

  it('rejects missing and short values', () => {
    expect(sessionSecretProblem(undefined)).toMatch(/not set/);
    expect(sessionSecretProblem('short')).toMatch(/32 characters/);
  });

  it('rejects placeholders from the example files', () => {
    expect(sessionSecretProblem('change-me-at-least-32-characters-long')).toMatch(/placeholder/);
  });
});
