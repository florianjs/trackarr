/**
 * GET /api/auth/pow
 * Generate a Proof of Work challenge for registration
 */
import { generatePoWChallenge } from '../../utils/pow';

export default defineEventHandler(async () => {
  const challenge = await generatePoWChallenge();
  return challenge;
});
