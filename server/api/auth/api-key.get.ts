import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { generateApiKey } from '../../utils/apiKey';

/**
 * GET /api/auth/api-key
 * Returns the current user's Torznab API key, created on first request
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const userId = session.user.id;

  const [current] = await db
    .select({ apiKey: users.apiKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (current?.apiKey) return { apiKey: current.apiKey };

  // Only fill an empty column: two tabs opening the page at once keep one key
  await db
    .update(users)
    .set({ apiKey: generateApiKey() })
    .where(and(eq(users.id, userId), isNull(users.apiKey)));

  const [created] = await db
    .select({ apiKey: users.apiKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return { apiKey: created?.apiKey ?? null };
});
