/**
 * GET /api/auth/challenge
 * Get salt and login challenge for a username
 * Returns fake data for non-existent users to prevent enumeration
 */
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../../db';
import { users } from '../../db/schema';
import { redis } from '../../redis/client';

const CHALLENGE_TTL = 300; // 5 minutes

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
    const fakeSalt = randomBytes(32).toString('base64');
    await redis.set(`login:fake:${challenge}`, '1', 'EX', CHALLENGE_TTL);
    return { salt: fakeSalt, challenge };
  }
  
  // Store challenge with user ID association
  await redis.set(`login:${challenge}`, user.id, 'EX', CHALLENGE_TTL);
  
  return { 
    salt: user.authSalt, 
    challenge,
  };
});
