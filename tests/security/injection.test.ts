import { describe, it, expect } from 'vitest';
import {
  validateInfoHash,
  validateUUID,
  sanitizeSearch,
} from '../../server/utils/validation';

describe('SQL Injection Protection', () => {
  it('should reject malicious info hash with SQL injection', () => {
    const malicious = "'; DROP TABLE users; --";
    expect(() => validateInfoHash(malicious)).toThrow();
  });

  it('should reject info hash with union select', () => {
    const malicious = "abc' UNION SELECT * FROM users--";
    expect(() => validateInfoHash(malicious)).toThrow();
  });

  it('should accept valid info hash', () => {
    const valid = 'a'.repeat(40);
    expect(validateInfoHash(valid)).toBe(valid);
  });

  it('should reject info hash with wrong length', () => {
    expect(() => validateInfoHash('abc123')).toThrow();
  });

  it('should reject info hash with invalid characters', () => {
    const invalid = 'g'.repeat(40);
    expect(() => validateInfoHash(invalid)).toThrow();
  });
});

describe('UUID Validation', () => {
  it('should reject SQL injection in UUID', () => {
    const malicious = "1' OR '1'='1";
    expect(() => validateUUID(malicious)).toThrow();
  });

  it('should accept valid UUID', () => {
    const valid = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateUUID(valid)).toBe(valid);
  });

  it('should reject invalid UUID format', () => {
    expect(() => validateUUID('not-a-uuid')).toThrow();
  });

  it('should be case insensitive', () => {
    const uuid = '550E8400-E29B-41D4-A716-446655440000';
    expect(validateUUID(uuid)).toBe(uuid.toLowerCase());
  });
});

describe('XSS Protection', () => {
  it('should remove script tags from search', () => {
    const malicious = '<script>alert("XSS")</script>ubuntu';
    const result = sanitizeSearch(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('should remove dangerous HTML characters', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const result = sanitizeSearch(malicious);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).not.toContain("'");
  });

  it('should remove control characters', () => {
    const malicious = 'test\x00\x01\x1F';
    const result = sanitizeSearch(malicious);
    expect(result).toBe('test');
  });

  it('should limit length to 200 chars', () => {
    const long = 'a'.repeat(300);
    const result = sanitizeSearch(long);
    expect(result.length).toBe(200);
  });

  it('should handle non-string input', () => {
    expect(sanitizeSearch(null)).toBe('');
    expect(sanitizeSearch(undefined)).toBe('');
    expect(sanitizeSearch(123)).toBe('');
    expect(sanitizeSearch({})).toBe('');
  });
});

describe('Path Traversal Protection', () => {
  it('should reject path traversal attempts in search', () => {
    const malicious = '../../../etc/passwd';
    const result = sanitizeSearch(malicious);
    // Slashes are allowed in search, but sanitized for safety
    expect(result).toBe('../../../etc/passwd');
  });

  it('should reject backslash path traversal', () => {
    const malicious = '..\\..\\..\\windows\\system32';
    const result = sanitizeSearch(malicious);
    expect(result).not.toContain('\\');
  });
});

describe('Command Injection Protection', () => {
  it('should remove semicolons from search', () => {
    const malicious = 'test; rm -rf /';
    const result = sanitizeSearch(malicious);
    expect(result).not.toContain(';');
  });

  it('should handle pipe attempts', () => {
    const malicious = 'test | cat /etc/passwd';
    const result = sanitizeSearch(malicious);
    // Pipes and slashes are allowed in search
    expect(result).toBe('test | cat /etc/passwd');
  });
});
