/**
 * Proof of Work utilities for anti-abuse
 * Server-side PoW challenge generation and verification
 */
import { randomBytes, createHash } from 'crypto';
import { redis } from '../redis/client';

// Difficulty: number of leading zeros required in hash
// 4 = ~0.5s, 5 = ~2-5s, 6 = ~30s on modern hardware
const POW_DIFFICULTY = 5;
const CHALLENGE_TTL = 300; // 5 minutes

export interface PoWChallenge {
  challenge: string;
  difficulty: number;
}

export interface PoWSolution {
  challenge: string;
  nonce: string;
  hash: string;
}

/**
 * Generate a new PoW challenge
 * Stores in Redis with TTL to prevent replay attacks
 */
export async function generatePoWChallenge(): Promise<PoWChallenge> {
  const challenge = randomBytes(32).toString('hex');
  
  // Store challenge with TTL - value is timestamp for debugging
  await redis.set(`pow:${challenge}`, Date.now().toString(), 'EX', CHALLENGE_TTL);
  
  return {
    challenge,
    difficulty: POW_DIFFICULTY,
  };
}

/**
 * Verify a PoW solution
 * Returns true if valid, false otherwise
 * Deletes challenge after verification to prevent reuse
 */
export async function verifyPoWSolution(solution: PoWSolution): Promise<boolean> {
  // Check if challenge exists and hasn't been used
  const exists = await redis.get(`pow:${solution.challenge}`);
  if (!exists) {
    return false;
  }
  
  // Verify the hash computation
  const input = `${solution.challenge}:${solution.nonce}`;
  const computed = createHash('sha256').update(input).digest('hex');
  
  // Check hash matches what client sent
  if (computed !== solution.hash) {
    return false;
  }
  
  // Check hash has required leading zeros
  const target = '0'.repeat(POW_DIFFICULTY);
  if (!solution.hash.startsWith(target)) {
    return false;
  }
  
  // Delete challenge to prevent reuse (one-time use)
  await redis.del(`pow:${solution.challenge}`);
  
  return true;
}

/**
 * Get current PoW difficulty (for dynamic adjustment if needed)
 */
export function getPoWDifficulty(): number {
  return POW_DIFFICULTY;
}
