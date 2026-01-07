import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

/**
 * Derive encryption key from password using scrypt
 */
export async function deriveKey(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypt text using AES-256-GCM
 * Returns base64 encoded: encrypted:authTag
 */
export function encrypt(text: string, key: Buffer, iv: Buffer): string {
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${encrypted}:${authTag.toString('base64')}`;
}

/**
 * Decrypt AES-256-GCM encrypted data
 * Input format: encrypted:authTag (base64)
 */
export function decrypt(
  encryptedData: string,
  key: Buffer,
  iv: Buffer
): string {
  const [encrypted, authTag] = encryptedData.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate cryptographically secure salt (32 bytes, base64)
 */
export function generateSalt(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Generate cryptographically secure IV (16 bytes, base64)
 */
export function generateIv(): string {
  return randomBytes(IV_LENGTH).toString('base64');
}

/**
 * Encrypt a nullable field - returns null if input is null/undefined
 */
export function encryptField(
  value: string | null | undefined,
  key: Buffer,
  iv: Buffer
): string | null {
  if (value == null) return null;
  return encrypt(value, key, iv);
}

/**
 * Decrypt a nullable field - returns null if input is null/undefined
 */
export function decryptField(
  value: string | null | undefined,
  key: Buffer,
  iv: Buffer
): string | null {
  if (value == null) return null;
  return decrypt(value, key, iv);
}
