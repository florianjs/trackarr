import { db } from '~~/server/db';
import { users } from '~~/server/db/schema';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { ilike } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const query = getQuery(event);
  const search = query.search as string;

  if (!search) {
    return [];
  }

  const results = await db.query.users.findMany({
    where: ilike(users.username, `%${search}%`),
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

  return results;
});
