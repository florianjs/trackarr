import { describe, it, expect } from 'vitest';
import { checkSession } from '../server/utils/sessionRules';

describe('checkSession', () => {
  const user = { isBanned: false, sessionVersion: 3 };

  it('accepts a session issued with the current version', () => {
    expect(checkSession(3, user)).toBe('valid');
  });

  it('revokes a session issued before a version bump', () => {
    expect(checkSession(2, user)).toBe('revoked');
  });

  it('revokes a session claiming a version never issued', () => {
    expect(checkSession(4, user)).toBe('revoked');
  });

  it('treats sessions issued before versions existed as version 0', () => {
    expect(checkSession(undefined, { isBanned: false, sessionVersion: 0 })).toBe('valid');
    expect(checkSession(undefined, user)).toBe('revoked');
  });

  it('rejects banned users whatever the version', () => {
    expect(checkSession(3, { ...user, isBanned: true })).toBe('banned');
  });

  it('rejects sessions of deleted users', () => {
    expect(checkSession(0, undefined)).toBe('banned');
  });
});
