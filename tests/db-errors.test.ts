import { describe, it, expect } from 'vitest';
import { isUniqueViolation } from '../server/utils/dbErrors';

describe('isUniqueViolation', () => {
  it('finds the code on the error or its wrapped cause', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation(new Error('Failed query', { cause: { code: '23505' } }))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isUniqueViolation(new Error('boom', { cause: { code: '23503' } }))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });
});
