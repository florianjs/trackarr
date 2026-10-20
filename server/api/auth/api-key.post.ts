import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { generateApiKey } from '../../utils/apiKey';
import { protectEndpoint } from '../../utils/rateLimit';

/**
 * POST /api/auth/api-key
 * Rotate the current user's Torznab API key: indexers using the old one stop
 * working, the passkey (announces, downloaded .torrent files) is untouched
 */
export default defineEventHandler(async (event) => {
  await protectEndpoint(event, 'mutation');
  const session = await requireAuthSession(event);

  const apiKey = generateApiKey();
  await db.update(users).set({ apiKey }).where(eq(users.id, session.user.id));

  return { apiKey };
});
