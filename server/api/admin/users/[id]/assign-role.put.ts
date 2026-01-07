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

  // roleId can be null to remove role
  const roleId = body.roleId || null;

  const [updatedUser] = await db
    .update(users)
    .set({ roleId })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      roleId: users.roleId,
    });

  if (!updatedUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  return updatedUser;
});
