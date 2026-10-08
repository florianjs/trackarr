import { describe, it, expect } from 'vitest';
import { createCipheriv, randomBytes } from 'crypto';
import {
  deriveKey,
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  generateLegacyIv,
} from '../../server/utils/panic';

describe('Panic encryption', () => {
  const salt = randomBytes(32);

  it('round-trips a value', async () => {
    const key = await deriveKey('correct horse battery', salt);
    const ct = encrypt('d8:announce42:http://tracker', key);
    expect(decrypt(ct, key)).toBe('d8:announce42:http://tracker');
  });

  it('uses a fresh IV for every encryption', async () => {
    const key = await deriveKey('correct horse battery', salt);
    const a = encrypt('same plaintext', key);
    const b = encrypt('same plaintext', key);
    expect(a).not.toBe(b);
    expect(a.split(':')[0]).not.toBe(b.split(':')[0]);
    expect(Buffer.from(a.split(':')[0]!, 'base64')).toHaveLength(12);
  });

  it('rejects a wrong key', async () => {
    const key = await deriveKey('correct horse battery', salt);
    const wrong = await deriveKey('wrong password', salt);
    const ct = encrypt('secret', key);
    expect(() => decrypt(ct, wrong)).toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const key = await deriveKey('correct horse battery', salt);
    const [iv, data, tag] = encrypt('secret value', key).split(':');
    const flipped = Buffer.from(data!, 'base64');
    flipped[0] = flipped[0]! ^ 1;
    expect(() =>
      decrypt(`${iv}:${flipped.toString('base64')}:${tag}`, key)
    ).toThrow();
  });

  it('still decrypts the legacy shared-IV format', async () => {
    const key = await deriveKey('legacy-hash', salt);
    const iv = generateLegacyIv();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update('old data', 'utf8', 'base64');
    enc += cipher.final('base64');
    const legacy = `${enc}:${cipher.getAuthTag().toString('base64')}`;

    expect(decrypt(legacy, key, iv)).toBe('old data');
    expect(() => decrypt(legacy, key)).toThrow();
  });

  it('keeps null fields null', async () => {
    const key = await deriveKey('pw', salt);
    expect(encryptField(null, key)).toBeNull();
    expect(decryptField(undefined, key)).toBeNull();
  });
});
