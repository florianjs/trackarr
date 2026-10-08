import { randomBytes } from 'crypto';

/**
 * Generate a random passkey (40 hex chars)
 */
export function generatePasskey(): string {
  return randomBytes(20).toString('hex');
}
