/**
 * Proof of Work rules shared by the solver (browser) and the verifier (server).
 * Difficulty is the number of leading zero bits required in
 * SHA256(challenge:nonce), so a solve takes 2^difficulty hashes on average.
 */

// ~2^22 hashes: about 1-2 s for the browser solver on a recent laptop,
// see doc/guide/configuration.md (POW_DIFFICULTY)
export const POW_DEFAULT_DIFFICULTY = 22;
export const POW_MIN_DIFFICULTY = 16;
export const POW_MAX_DIFFICULTY = 32;

/**
 * Number of leading zero bits of a hash
 */
export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/**
 * Difficulty from the POW_DIFFICULTY env var: a whole number of bits within
 * the bounds, otherwise the default (a typo must not make the PoW trivial)
 */
export function parsePoWDifficulty(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return POW_DEFAULT_DIFFICULTY;
  const value = Number(raw);
  if (
    !Number.isInteger(value) ||
    value < POW_MIN_DIFFICULTY ||
    value > POW_MAX_DIFFICULTY
  ) {
    console.warn(
      `[PoW] Ignoring POW_DIFFICULTY=${raw}: expected ${POW_MIN_DIFFICULTY}-${POW_MAX_DIFFICULTY} bits, using ${POW_DEFAULT_DIFFICULTY}`
    );
    return POW_DEFAULT_DIFFICULTY;
  }
  return value;
}
