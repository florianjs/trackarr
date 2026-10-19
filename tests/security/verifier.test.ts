import { describe, it, expect } from 'vitest';
import {
  checkVerifier,
  hashVerifier,
  isHashedVerifier,
} from '../../server/utils/verifier';

const verifier = 'q2Vw9n7mJx0bQkQ4f0sQ8T9yHn2u5VtVf1t3kZ7a0eA=';

describe('verifier storage', () => {
  it('stores a salted scrypt hash, never the verifier', async () => {
    const stored = await hashVerifier(verifier);
    expect(isHashedVerifier(stored)).toBe(true);
    expect(stored).not.toContain(verifier);
    expect(await hashVerifier(verifier)).not.toBe(stored);
  });

  it('accepts the right verifier and rejects others', async () => {
    const stored = await hashVerifier(verifier);
    expect(await checkVerifier(stored, verifier)).toBe(true);
    expect(await checkVerifier(stored, verifier.replace('q', 'r'))).toBe(false);
    expect(await checkVerifier(stored, '')).toBe(false);
  });

  it('still checks rows not converted yet', async () => {
    expect(await checkVerifier(verifier, verifier)).toBe(true);
    expect(await checkVerifier(verifier, 'x' + verifier.slice(1))).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await checkVerifier('scrypt$16384$8$1$', verifier)).toBe(false);
    expect(await checkVerifier('scrypt$garbage', verifier)).toBe(false);
  });
});
