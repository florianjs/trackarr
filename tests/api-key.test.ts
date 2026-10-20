import { describe, it, expect } from 'vitest';
import { generateApiKey, parseTorznabCredential } from '../server/utils/apiKey';

describe('generateApiKey', () => {
  it('is prefixed and parses back as an API key', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^tk_[a-f0-9]{40}$/);
    expect(parseTorznabCredential(key)).toEqual({ kind: 'apiKey', value: key });
  });

  it('is random', () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe('parseTorznabCredential', () => {
  it('accepts 40 and legacy 32 char passkeys', () => {
    const passkey = 'a'.repeat(40);
    expect(parseTorznabCredential(passkey)).toEqual({ kind: 'passkey', value: passkey });
    expect(parseTorznabCredential('b'.repeat(32))?.kind).toBe('passkey');
  });

  it('normalizes case and surrounding spaces', () => {
    expect(parseTorznabCredential(` TK_${'AB'.repeat(20)} `)).toEqual({
      kind: 'apiKey',
      value: `tk_${'ab'.repeat(20)}`,
    });
  });

  it('rejects anything else', () => {
    expect(parseTorznabCredential(undefined)).toBeNull();
    expect(parseTorznabCredential(['a'.repeat(40)])).toBeNull();
    expect(parseTorznabCredential('a'.repeat(36))).toBeNull();
    expect(parseTorznabCredential(`tk_${'a'.repeat(32)}`)).toBeNull();
    expect(parseTorznabCredential(`tk_${'z'.repeat(40)}`)).toBeNull();
  });
});
