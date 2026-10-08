import { z } from 'zod';
import { db } from '~~/server/db';
import { users } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { validateBody, validateParam, uuidSchema } from '~~/server/utils/schemas';
import { and, count, eq, ne } from 'drizzle-orm';
import { invalidateTrackerUsers } from '~~/server/tracker/lookups';

const roleSchema = z.object({
  isAdmin: z.boolean(),
  isModerator: z.boolean(),
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  const body = await validateBody(event, roleSchema);

  // Never leave the instance without an admin
  if (!body.isAdmin) {
    const [others] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isAdmin, true), ne(users.id, id)));

    if (others!.count === 0) {
      throw createError({
        statusCode: 400,
        message: 'Cannot remove the last admin',
      });
    }
  }

  const updatedUser = await db
    .update(users)
    .set({
      isAdmin: body.isAdmin,
      isModerator: body.isModerator,
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      isModerator: users.isModerator,
    });

  if (!updatedUser.length) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  // Tracker caches the row for a few seconds
  invalidateTrackerUsers();

  return updatedUser[0];
});
