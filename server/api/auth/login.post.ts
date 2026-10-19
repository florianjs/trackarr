import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, bannedIps } from '../../db/schema';
import { validateBody, loginSchema } from '../../utils/schemas';
import { redis } from '../../redis/client';
import { FAKE_CHALLENGE_MARKER } from '../../utils/crypto';
import { isHoneypotFilled } from '../../utils/honeypot';
import { SecurityAlertType, sendSecurityAlert } from '../../utils/alerts';
import {
  burnVerifierCheck,
  checkVerifier,
  hashVerifier,
  isHashedVerifier,
} from '../../utils/verifier';
import {
  assertAccountNotLocked,
  getClientIP,
  protectEndpoint,
  recordAccountFailure,
} from '../../utils/rateLimit';

/**
 * POST /api/auth/login
 * Authenticate with the zero-knowledge verifier: derived from the password in
 * the browser, which never sends the password itself
 */
export default defineEventHandler(async (event) => {
  await protectEndpoint(event, 'login');

  // Validate request body with Zod (username, challenge, verifier)
  const body = await validateBody(event, loginSchema);
  if (isHoneypotFilled(body.hpot_field)) {
    void sendSecurityAlert(SecurityAlertType.HONEYPOT_TRIGGERED, {
      title: 'Bot filled the hidden login field',
      description: 'Login refused like a wrong password',
      ip: getClientIP(event),
      details: { username: body.username },
    }).catch(() => {});
    throw createError({ statusCode: 401, message: 'Invalid credentials' });
  }
  await assertAccountNotLocked(body.username);

  // Atomically consume the challenge: a concurrent request cannot reuse it
  const userId = await redis.getdel(`login:${body.challenge}`);
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired challenge',
    });
  }

  // Not tied to the account: checked before looking it up
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

  // Pages loaded before the protocol change still send a proof
  if (!body.verifier) {
    throw createError({
      statusCode: 400,
      message: 'The login form was updated: please reload the page',
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

  // The verifier is derived from the password in the browser (the password
  // never leaves it) and compared with its stored scrypt hash
  const valid =
    user && user.username === body.username && user.authVerifier
      ? await checkVerifier(user.authVerifier, body.verifier)
      : // Same cost as a real check: timing must not reveal unknown accounts
        await burnVerifierCheck(body.verifier).then(() => false);

  if (!valid || !user) {
    await recordAccountFailure(body.username, clientIp ?? undefined);
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  }

  // Row written before verifiers were hashed: convert it now
  if (user.authVerifier && !isHashedVerifier(user.authVerifier)) {
    await db
      .update(users)
      .set({ authVerifier: await hashVerifier(body.verifier) })
      .where(and(eq(users.id, user.id), eq(users.authVerifier, user.authVerifier)));
  }

  // Only after the proof: before it, the answer would tell anyone guessing
  // usernames that this account exists and is banned
  if (user.isBanned) {
    throw createError({
      statusCode: 403,
      message: 'Your account has been banned',
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
