/**
 * Storage of the zero-knowledge login verifier.
 *
 * The browser derives the verifier from the password (PBKDF2, see
 * app/utils/crypto.ts); the password never reaches the server. The verifier
 * itself is what proves a login, so storing it as is made a database dump
 * enough to log in as anyone. Only a salted scrypt hash is stored now: a dump
 * forces an attacker to guess each password through both derivations.
 *
 * Stored format: `scrypt$N$r$p$<salt b64>$<hash b64>`. Rows written before
 * this change hold the bare verifier; they are converted at startup
 * (server/plugins/verifier-hash.ts) or on the next login.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto';

const PREFIX = 'scrypt$';
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;

function scryptAsync(input: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(input, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export function isHashedVerifier(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export async function hashVerifier(verifier: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(verifier, salt, PARAMS);
  const { N, r, p } = PARAMS;
  return `${PREFIX}${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Constant-time check of a provided verifier against the stored value */
export async function checkVerifier(stored: string, provided: string): Promise<boolean> {
  if (!isHashedVerifier(stored)) {
    // Not converted yet: bare verifier. Same scrypt cost as a hashed row, so
    // timing does not tell which accounts are not converted yet.
    await burnVerifierCheck(provided);
    const a = Buffer.from(stored);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const [, n, r, p, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash ?? '', 'base64');
  if (!n || !r || !p || !salt || expected.length !== KEY_LENGTH) return false;
  const key = await scryptAsync(provided, Buffer.from(salt, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

/**
 * Same cost as a real check, for unknown usernames: answering faster for
 * them would tell which accounts exist.
 */
export async function burnVerifierCheck(provided: string): Promise<void> {
  await scryptAsync(provided, randomBytes(16), PARAMS);
}
