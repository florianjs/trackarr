import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuthSession, type AuthUserState } from './adminAuth';
import { parseTorznabCredential } from './apiKey';

export interface Uploader {
  id: string;
  isAdmin: boolean;
  isModerator: boolean;
  passkey: string;
}

/**
 * Who uploads: the signed-in user, or the owner of the API key sent as
 * `Authorization: Bearer tk_...` (upload CLI). The key is the one of the
 * Integrations page; a header is never sent by a browser on its own, so this
 * opens no CSRF path. Banned and unpaid accounts are refused either way.
 */
export async function requireUploader(event: H3Event): Promise<Uploader> {
  const header = getHeader(event, 'authorization');
  if (header) {
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    const credential = match ? parseTorznabCredential(match[1]) : null;
    if (!credential || credential.kind !== 'apiKey') {
      throw createError({ statusCode: 401, message: 'Invalid API key' });
    }
    const [user] = await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
        isModerator: users.isModerator,
        isBanned: users.isBanned,
        paymentPending: users.paymentPending,
        passkey: users.passkey,
      })
      .from(users)
      .where(eq(users.apiKey, credential.value))
      .limit(1);
    if (!user) throw createError({ statusCode: 401, message: 'Invalid API key' });
    if (user.isBanned) throw createError({ statusCode: 403, message: 'Your account has been banned' });
    if (user.paymentPending) {
      throw createError({ statusCode: 402, message: 'Payment required to activate your account' });
    }
    return { id: user.id, isAdmin: user.isAdmin, isModerator: user.isModerator, passkey: user.passkey };
  }

  const session = await requireAuthSession(event);
  const state = event.context.authUser as AuthUserState;
  return {
    id: session.user.id,
    isAdmin: state.isAdmin,
    isModerator: state.isModerator,
    passkey: state.passkey,
  };
}
