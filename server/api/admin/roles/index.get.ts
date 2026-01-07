import { db } from '~~/server/db';
import { roles } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const allRoles = await db.query.roles.findMany({
    orderBy: (r, { asc }) => [asc(r.name)],
  });

  return allRoles;
});
