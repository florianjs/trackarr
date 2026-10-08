import { eq } from 'drizzle-orm';
import { createHash, timingSafeEqual } from 'crypto';
import { db } from '../../db';
import { users, bannedIps } from '../../db/schema';
import { validateBody, loginSchema } from '../../utils/schemas';
import { redis } from '../../redis/client';
import { FAKE_CHALLENGE_MARKER } from '../../utils/crypto';
import { getClientIP, protectEndpoint } from '../../utils/rateLimit';

/**
 * POST /api/auth/login
 * Authenticate user with Zero Knowledge proof
 * User proves knowledge of password without sending it
 */
export default defineEventHandler(async (event) => {
  await protectEndpoint(event, 'login');

  // Validate request body with Zod (now expects username, challenge, proof)
  const body = await validateBody(event, loginSchema);

  // Atomically consume the challenge: a concurrent request cannot reuse it
  const userId = await redis.getdel(`login:${body.challenge}`);
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired challenge',
    });
  }

  // Unknown usernames get a decoy challenge: fail exactly like a bad password
  const user =
    userId === FAKE_CHALLENGE_MARKER
      ? undefined
      : await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .then((r) => r[0]);

  if (!user || user.username !== body.username) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  }

  // Check if user is banned
  if (user.isBanned) {
    throw createError({
      statusCode: 403,
      message: 'Your account has been banned',
    });
  }

  // Check if IP is banned
  const ip = getClientIP(event);
  const clientIp = ip === 'unknown' ? null : ip;

  if (clientIp) {
    const isIpBanned = await db
      .select()
      .from(bannedIps)
      .where(eq(bannedIps.ip, clientIp))
      .limit(1)
      .then((r) => r.length > 0);

    if (isIpBanned) {
      throw createError({
        statusCode: 403,
        message: 'Your IP address is banned',
      });
    }
  }

  // Verify ZKE proof
  // Expected proof = SHA256(authVerifier + challenge)
  if (!user.authVerifier) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  }
  
  const expectedProof = createHash('sha256')
    .update(user.authVerifier + body.challenge)
    .digest();
  const providedProof = Buffer.from(body.proof, 'hex');

  if (
    providedProof.length !== expectedProof.length ||
    !timingSafeEqual(providedProof, expectedProof)
  ) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  }

  // Update last seen and IP
  await db
    .update(users)
    .set({ lastSeen: new Date(), lastIp: clientIp })
    .where(eq(users.id, user.id));

  // Set user session using nuxt-auth-utils
  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      isModerator: user.isModerator,
      uploaded: user.uploaded,
      downloaded: user.downloaded,
    },
    loggedInAt: Date.now(),
  });

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      isModerator: user.isModerator,
      uploaded: user.uploaded,
      downloaded: user.downloaded,
    },
  };
});
