import { describe, it, expect, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import {
  leadingZeroBits,
  parsePoWDifficulty,
  POW_DEFAULT_DIFFICULTY,
} from '../shared/utils/pow';
import { createPoWHasher, leadingZeroBitsOfWords } from '../app/utils/powHasher';
import { solvePoW } from '../app/utils/crypto';

const challenges = new Set<string>();
vi.mock('../server/redis/client', () => ({
  redis: { del: async (key: string) => (challenges.delete(key) ? 1 : 0) },
}));

process.env.POW_DIFFICULTY = '16';
const { isValidPoWHash, verifyPoWSolution, getPoWDifficulty } = await import(
  '../server/utils/pow'
);

const wordsToHex = (words: Uint32Array) =>
  Array.from(words, (w) => w.toString(16).padStart(8, '0')).join('');

describe('createPoWHasher', () => {
  it('matches SHA-256 for every prefix and nonce length', () => {
    const prefixes = ['', ':', 'a'.repeat(55), 'b'.repeat(63), 'c'.repeat(64), 'd'.repeat(130)];
    prefixes.push(`${randomBytes(32).toString('hex')}:`);
    for (const prefix of prefixes) {
      const hash = createPoWHasher(prefix);
      for (const nonce of [0, 7, 1234567, 2 ** 40]) {
        const expected = createHash('sha256').update(`${prefix}${nonce}`).digest('hex');
        expect(wordsToHex(hash(nonce))).toBe(expected);
      }
    }
  });
});

describe('leadingZeroBits', () => {
  it('counts zero bits across bytes and words', () => {
    expect(leadingZeroBits(new Uint8Array([0x80, 0]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0, 0, 0x01]))).toBe(23);
    expect(leadingZeroBits(new Uint8Array([0, 0]))).toBe(16);
    expect(leadingZeroBitsOfWords(new Uint32Array([0, 0x0000ffff]))).toBe(48);
  });
});

describe('parsePoWDifficulty', () => {
  it('reads a bit count within bounds', () => {
    expect(parsePoWDifficulty(undefined)).toBe(POW_DEFAULT_DIFFICULTY);
    expect(parsePoWDifficulty('20')).toBe(20);
  });

  it('falls back to the default instead of a trivial difficulty', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The old hex-digit setting must not mean 5 bits
    expect(parsePoWDifficulty('5')).toBe(POW_DEFAULT_DIFFICULTY);
    expect(parsePoWDifficulty('40')).toBe(POW_DEFAULT_DIFFICULTY);
    expect(parsePoWDifficulty('abc')).toBe(POW_DEFAULT_DIFFICULTY);
  });
});

describe('PoW verification', () => {
  it('reads the difficulty from POW_DIFFICULTY', () => {
    expect(getPoWDifficulty()).toBe(16);
  });

  it('accepts a solution from the browser solver', async () => {
    const challenge = randomBytes(32).toString('hex');
    const solution = await solvePoW(challenge, 16);
    expect(isValidPoWHash(solution, 16)).toBe(true);

    challenges.add(`pow:${challenge}`);
    expect(await verifyPoWSolution(solution)).toBe(true);
    // A challenge is good for one registration only
    expect(await verifyPoWSolution(solution)).toBe(false);
  });

  it('rejects a hash that does not match or lacks work', async () => {
    const challenge = randomBytes(32).toString('hex');
    const solution = await solvePoW(challenge, 12);
    expect(isValidPoWHash(solution, 12)).toBe(true);
    // Not enough zero bits for a higher difficulty (unless lucky)
    const bits = leadingZeroBits(Buffer.from(solution.hash, 'hex'));
    expect(isValidPoWHash(solution, bits + 1)).toBe(false);

    const zeros = { ...solution, hash: '0'.repeat(64) };
    expect(isValidPoWHash(zeros, 12)).toBe(false);
    const otherNonce = { ...solution, nonce: `${solution.nonce}0` };
    expect(isValidPoWHash(otherNonce, 12)).toBe(false);
  });

  it('rejects unknown challenges', async () => {
    const challenge = randomBytes(32).toString('hex');
    const solution = await solvePoW(challenge, 12);
    expect(await verifyPoWSolution(solution)).toBe(false);
  });
});
