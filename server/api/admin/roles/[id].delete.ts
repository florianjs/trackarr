import { db } from '~~/server/db';
import { roles, users } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Role ID is required',
    });
  }

  // First, remove role from all users that have it
  await db.update(users).set({ roleId: null }).where(eq(users.roleId, id));

  // Then delete the role
  const [deletedRole] = await db
    .delete(roles)
    .where(eq(roles.id, id))
    .returning();

  if (!deletedRole) {
    throw createError({
      statusCode: 404,
      message: 'Role not found',
    });
  }

  return { success: true, deleted: deletedRole };
});
