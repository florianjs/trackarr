import { createHash, randomBytes } from 'crypto';
import { readOptionalSecret } from './secrets';

/**
 * IP Hashing Utilities
 * IPs are hashed with SHA-256 + a daily rotating salt for privacy
 * The salt rotates daily to prevent long-term tracking while maintaining
 * short-term functionality (peer identification within swarm sessions)
 */

// Generate a daily salt based on date
// This allows peer matching within a day but prevents long-term IP tracking
// Known placeholder shipped in old .env.example files: IPv4 hashes made with a
// public secret can be reversed by brute force in seconds.
const PLACEHOLDER_IP_HASH_SECRET = 'trackarr-default-secret-change-me';
let devIpHashSecret: string | null = null;

function getIpHashSecret(): string {
  const secret = readOptionalSecret('IP_HASH_SECRET');

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === PLACEHOLDER_IP_HASH_SECRET || secret.length < 32) {
      throw new Error(
        'IP_HASH_SECRET must be set to a random value of at least 32 characters'
      );
    }
    return secret;
  }

  if (secret) return secret;

  // Development without a secret: random per process, never a shared default
  if (!devIpHashSecret) {
    devIpHashSecret = randomBytes(32).toString('hex');
    console.warn('[Security] IP_HASH_SECRET not set, using a random dev secret');
  }
  return devIpHashSecret;
}

function getDailySalt(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${getIpHashSecret()}:${date}`;
}

/**
 * Hash an IP address for storage
 * Uses SHA-256 with a daily rotating salt
 * Result is a 16-char hex string (truncated for storage efficiency)
 */
export function hashIP(ip: string): string {
  const salt = getDailySalt();
  const hash = createHash('sha256').update(`${salt}:${ip}`).digest('hex');

  // Return first 16 chars - enough for uniqueness within daily context
  return hash.slice(0, 16);
}

/**
 * Hash a peer ID for anonymization
 * Peer IDs are client-generated and could contain identifying info
 */
export function hashPeerId(peerId: string): string {
  const salt = getDailySalt();
  const hash = createHash('sha256')
    .update(`${salt}:peer:${peerId}`)
    .digest('hex');

  return hash.slice(0, 16);
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Value stored for login challenges issued to unknown usernames.
 * Not a valid user id, so login fails like a wrong password.
 */
export const FAKE_CHALLENGE_MARKER = 'fake';
