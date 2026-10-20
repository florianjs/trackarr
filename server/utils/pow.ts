/**
 * Proof of Work utilities for anti-abuse
 * Server-side PoW challenge generation and verification
 */
import { randomBytes, createHash } from 'crypto';
import { redis } from '../redis/client';
import { leadingZeroBits, parsePoWDifficulty } from '../../shared/utils/pow';

// Leading zero bits required in the hash (POW_DIFFICULTY): each extra bit
// doubles the client's work, verification stays a single hash
const POW_DIFFICULTY = parsePoWDifficulty(process.env.POW_DIFFICULTY);
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
 * Check a solution's hash and work, without touching the challenge store
 */
export function isValidPoWHash(solution: PoWSolution, difficulty: number): boolean {
  const input = `${solution.challenge}:${solution.nonce}`;
  const computed = createHash('sha256').update(input).digest();

  // Check hash matches what client sent, and has enough leading zero bits
  return (
    computed.toString('hex') === solution.hash &&
    leadingZeroBits(computed) >= difficulty
  );
}

/**
 * Verify a PoW solution
 * Returns true if valid, false otherwise
 * Consumes the challenge before verification to prevent reuse
 */
export async function verifyPoWSolution(solution: PoWSolution): Promise<boolean> {
  // Atomically consume the challenge first: concurrent requests reusing the
  // same solution must not all pass. A failed attempt burns the challenge.
  const consumed = await redis.del(`pow:${solution.challenge}`);
  if (consumed !== 1) {
    return false;
  }

  return isValidPoWHash(solution, POW_DIFFICULTY);
}

/**
 * Get current PoW difficulty (for dynamic adjustment if needed)
 */
export function getPoWDifficulty(): number {
  return POW_DIFFICULTY;
}
