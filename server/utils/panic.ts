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
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;

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
 * Encrypt text using AES-256-GCM with a fresh random IV per call
 * Returns base64 encoded: iv:encrypted:authTag
 */
export function encrypt(text: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
}

/**
 * Decrypt AES-256-GCM encrypted data
 * Input format: iv:encrypted:authTag (base64)
 * Legacy format (shared IV): encrypted:authTag, requires legacyIv
 */
export function decrypt(
  encryptedData: string,
  key: Buffer,
  legacyIv?: Buffer
): string {
  const parts = encryptedData.split(':');
  let iv: Buffer;
  let encrypted: string;
  let authTag: string;

  if (parts.length === 3) {
    iv = Buffer.from(parts[0]!, 'base64');
    encrypted = parts[1]!;
    authTag = parts[2]!;
  } else if (parts.length === 2 && legacyIv) {
    iv = legacyIv;
    encrypted = parts[0]!;
    authTag = parts[1]!;
  } else {
    throw new Error('Invalid encrypted data format');
  }

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
 * Generate a legacy-sized IV (16 bytes). Only used by tests for the legacy format.
 */
export function generateLegacyIv(): Buffer {
  return randomBytes(LEGACY_IV_LENGTH);
}

/**
 * Encrypt a nullable field - returns null if input is null/undefined
 */
export function encryptField(
  value: string | null | undefined,
  key: Buffer
): string | null {
  if (value == null) return null;
  return encrypt(value, key);
}

/**
 * Decrypt a nullable field - returns null if input is null/undefined
 */
export function decryptField(
  value: string | null | undefined,
  key: Buffer,
  legacyIv?: Buffer
): string | null {
  if (value == null) return null;
  return decrypt(value, key, legacyIv);
}
