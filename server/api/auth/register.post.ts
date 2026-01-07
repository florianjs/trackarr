import { count, eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { users, bannedIps, invitations } from '../../db/schema';
import { generateToken } from '../../utils/crypto';
import {
  isRegistrationOpen,
  setRegistrationOpen,
  getStarterUpload,
  isInviteEnabled,
  getDefaultInvites,
} from '../../utils/settings';
import { validateBody, registerSchema } from '../../utils/schemas';
import { verifyPoWSolution } from '../../utils/pow';

/**
 * POST /api/auth/register
 * Register new user with Zero Knowledge Encryption
 * Server never receives password - only verifier and salt
 */
export default defineEventHandler(async (event) => {
  // Validate request body with Zod
  const body = await validateBody(event, registerSchema);

  // Verify Proof of Work first (anti-abuse)
  const powValid = await verifyPoWSolution({
    challenge: body.powChallenge,
    nonce: body.powNonce,
    hash: body.powHash,
  });
  
  if (!powValid) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired proof of work. Please refresh and try again.',
    });
  }

  // Check if IP is banned
  const ip =
    event.node.req.headers['x-forwarded-for'] ||
    event.node.req.socket.remoteAddress;
  const clientIp = Array.isArray(ip) ? ip[0] : ip;

  if (clientIp) {
    const isBanned = await db
      .select()
      .from(bannedIps)
      .where(eq(bannedIps.ip, clientIp))
      .limit(1)
      .then((r) => r.length > 0);

    if (isBanned) {
      throw createError({
        statusCode: 403,
        message: 'Your IP address is banned',
      });
    }
  }

  // Check if any users exist (setup mode)
  const userCount = await db.select({ count: count() }).from(users);
  const isFirstUser = userCount[0].count === 0;

  // If not first user, check if registration is open or invite code is valid
  let validInvite = null;
  if (!isFirstUser) {
    const regOpen = await isRegistrationOpen();
    const inviteEnabled = await isInviteEnabled();

    // Check invite code if provided
    if (body.inviteCode && inviteEnabled) {
      validInvite = await db.query.invitations.findFirst({
        where: and(
          eq(invitations.code, body.inviteCode.toUpperCase()),
          isNull(invitations.usedBy)
        ),
      });

      // If invite code provided but not found/valid, throw error immediately
      if (!validInvite) {
        throw createError({
          statusCode: 400,
          message: 'Invalid invite code',
        });
      }

      // Check if invite is expired
      if (
        validInvite?.expiresAt &&
        new Date(validInvite.expiresAt) < new Date()
      ) {
        throw createError({
          statusCode: 403,
          message: 'Invite code has expired',
        });
      }
    }

    // Registration blocked if: not open AND no valid invite
    if (!regOpen && !validInvite) {
      throw createError({
        statusCode: 403,
        message: inviteEnabled
          ? 'Registration is closed. A valid invite code is required.'
          : 'Registration is currently closed',
      });
    }
  }

  // Check for existing username
  const existingUsername = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.username, body.username))
    .limit(1);

  if (existingUsername.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Username already taken',
    });
  }

  // Create user with ZKE credentials (no password hash - we store verifier)
  const userId = crypto.randomUUID();
  const passkey = generateToken(16); // 32-char hex string for tracker auth
  const starterUpload = await getStarterUpload();
  const defaultInvites = await getDefaultInvites();

  // For first user, require and hash panic password
  let panicPasswordHash: string | null = null;
  if (isFirstUser) {
    if (!body.panicPassword) {
      throw createError({
        statusCode: 400,
        message: 'Panic password is required for admin account',
      });
    }
    panicPasswordHash = await hashPassword(body.panicPassword);
  }

  await db.insert(users).values({
    id: userId,
    username: body.username,
    authSalt: body.authSalt,
    authVerifier: body.authVerifier,
    passkey,
    isAdmin: isFirstUser,
    isModerator: false,
    lastIp: clientIp,
    uploaded: starterUpload,
    invitesRemaining: isFirstUser ? 10 : defaultInvites,
    panicPasswordHash,
  });

  // Mark invite as used if registration was via invite
  if (validInvite) {
    await db
      .update(invitations)
      .set({
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(eq(invitations.id, validInvite.id));
  }

  // If first user, close registration by default
  if (isFirstUser) {
    await setRegistrationOpen(false);
  }

  // Set user session using nuxt-auth-utils
  await setUserSession(event, {
    user: {
      id: userId,
      username: body.username,
      passkey,
      isAdmin: isFirstUser,
      isModerator: false,
      uploaded: starterUpload,
      downloaded: 0,
    },
    loggedInAt: Date.now(),
  });

  return {
    success: true,
    isFirstUser,
    user: {
      id: userId,
      username: body.username,
      isAdmin: isFirstUser,
      isModerator: false,
      uploaded: starterUpload,
      downloaded: 0,
    },
  };
});
