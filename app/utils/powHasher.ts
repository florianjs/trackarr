/**
 * Synchronous SHA-256 specialised for the Proof of Work loop.
 * One WebCrypto digest call per nonce spends most of its time in promise and
 * thread hops; hashing in plain JS, with the challenge's full blocks hashed
 * once up front, is several times faster, so the same wait buys more work.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const W = new Uint32Array(64);

/** Hash the 64-byte block at `offset` into `state` */
function compress(state: Uint32Array, block: Uint8Array, offset: number): void {
  for (let i = 0; i < 16; i++) {
    const j = offset + i * 4;
    W[i] = (block[j]! << 24) | (block[j + 1]! << 16) | (block[j + 2]! << 8) | block[j + 3]!;
  }
  for (let i = 16; i < 64; i++) {
    const w15 = W[i - 15]!;
    const w2 = W[i - 2]!;
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
  }

  let a = state[0]!, b = state[1]!, c = state[2]!, d = state[3]!;
  let e = state[4]!, f = state[5]!, g = state[6]!, h = state[7]!;
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i]! + W[i]!) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0;
    d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  state[0] = (state[0]! + a) | 0; state[1] = (state[1]! + b) | 0;
  state[2] = (state[2]! + c) | 0; state[3] = (state[3]! + d) | 0;
  state[4] = (state[4]! + e) | 0; state[5] = (state[5]! + f) | 0;
  state[6] = (state[6]! + g) | 0; state[7] = (state[7]! + h) | 0;
}

/**
 * Returns a function giving SHA256(prefix + nonce) as 8 big-endian words.
 * The prefix must be ASCII (the challenge is hex); the returned array is
 * reused between calls.
 */
export function createPoWHasher(prefix: string): (nonce: number) => Uint32Array {
  const prefixBytes = Uint8Array.from(prefix, (ch) => ch.charCodeAt(0));
  const fullBlocks = Math.floor(prefixBytes.length / 64);
  const midstate = Uint32Array.from(IV);
  for (let i = 0; i < fullBlocks; i++) compress(midstate, prefixBytes, i * 64);

  const tail = prefixBytes.subarray(fullBlocks * 64);
  const buffer = new Uint8Array(128);
  const state = new Uint32Array(8);

  return (nonce: number) => {
    const digits = nonce.toString();
    buffer.fill(0);
    buffer.set(tail);
    let length = tail.length;
    for (let i = 0; i < digits.length; i++) buffer[length++] = digits.charCodeAt(i);
    buffer[length] = 0x80;

    // Message length in bits, in the last 8 bytes of the final block
    const blocks = length + 9 <= 64 ? 1 : 2;
    const bits = (prefixBytes.length + digits.length) * 8;
    const end = blocks * 64;
    buffer[end - 4] = bits >>> 24;
    buffer[end - 3] = bits >>> 16;
    buffer[end - 2] = bits >>> 8;
    buffer[end - 1] = bits;

    state.set(midstate);
    compress(state, buffer, 0);
    if (blocks === 2) compress(state, buffer, 64);
    return state;
  };
}

/**
 * Number of leading zero bits of a hash given as 32-bit words
 */
export function leadingZeroBitsOfWords(words: Uint32Array): number {
  let bits = 0;
  for (const word of words) {
    if (word === 0) {
      bits += 32;
      continue;
    }
    return bits + Math.clz32(word);
  }
  return bits;
}
