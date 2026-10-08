import type { H3Event } from 'h3';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

/**
 * Authenticate an RSS feed request: logged-in session, or ?passkey= for
 * feed readers. A private tracker must not list its torrents publicly.
 */
export async function requireFeedAccess(event: H3Event): Promise<void> {
  const session = await getUserSession(event);
  if (session.user) {
    await requireAuthSession(event);
    return;
  }

  const passkey = getQuery(event).passkey;
  if (typeof passkey !== 'string' || !/^[a-f0-9]{32}([a-f0-9]{8})?$/i.test(passkey)) {
    throw createError({ statusCode: 401, message: 'Passkey required' });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.passkey, passkey.toLowerCase()), eq(users.isBanned, false)))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid passkey' });
  }
}
