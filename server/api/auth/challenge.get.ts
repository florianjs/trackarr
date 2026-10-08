/**
 * GET /api/auth/challenge
 * Get salt and login challenge for a username
 * Returns fake data for non-existent users to prevent enumeration
 */
import { eq } from 'drizzle-orm';
import { createHmac, randomBytes } from 'crypto';
import { db } from '../../db';
import { users } from '../../db/schema';
import { redis } from '../../redis/client';
import { FAKE_CHALLENGE_MARKER } from '../../utils/crypto';

const CHALLENGE_TTL = 300; // 5 minutes

// Fake salts must be stable per username, otherwise two calls reveal whether
// the account exists (real salts never change).
function fakeSaltFor(username: string): string {
  const secret =
    process.env.NUXT_SESSION_PASSWORD || process.env.IP_HASH_SECRET || '';
  return createHmac('sha256', `fake-salt:${secret}`)
    .update(username.toLowerCase())
    .digest('base64');
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const username = (query.username as string)?.trim();
  
  if (!username) {
    throw createError({
      statusCode: 400,
      message: 'Username is required',
    });
  }
  
  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { 
      id: true,
      authSalt: true,
    },
  });
  
  // Generate challenge regardless of user existence
  const challenge = randomBytes(32).toString('hex');
  
  if (!user || !user.authSalt) {
    // Return fake salt to prevent username enumeration
    // Timing attack mitigation: always do the same work
    await redis.set(
      `login:${challenge}`,
      FAKE_CHALLENGE_MARKER,
      'EX',
      CHALLENGE_TTL
    );
    return { salt: fakeSaltFor(username), challenge };
  }
  
  // Store challenge with user ID association
  await redis.set(`login:${challenge}`, user.id, 'EX', CHALLENGE_TTL);
  
  return { 
    salt: user.authSalt, 
    challenge,
  };
});
