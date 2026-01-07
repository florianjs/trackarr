import { db } from '~~/server/db';
import { users } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    });
  }

  const updatedUser = await db
    .update(users)
    .set({
      isAdmin: !!body.isAdmin,
      isModerator: !!body.isModerator,
    })
    .where(eq(users.id, id))
    .returning();

  if (!updatedUser.length) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  return updatedUser[0];
});
