import { db } from '~~/server/db';
import { users } from '~~/server/db/schema';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { escapeLike } from '~~/server/utils/validation';
import { ilike } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const query = getQuery(event);
  const search = typeof query.search === 'string' ? query.search.trim() : '';

  if (!search || search.length > 50) {
    return [];
  }

  const results = await db.query.users.findMany({
    where: ilike(users.username, `%${escapeLike(search)}%`),
    limit: 10,
    columns: {
      id: true,
      username: true,
      isAdmin: true,
      isModerator: true,
      isBanned: true,
      roleId: true,
      lastIp: true,
      createdAt: true,
    },
  });

  // Raw IPs are admin-only
  if (!session.user.isAdmin) {
    return results.map(({ lastIp: _lastIp, ...rest }) => rest);
  }

  return results;
});
