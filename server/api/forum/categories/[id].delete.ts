import { db } from '~~/server/db';
import { forumCategories } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Category ID is required',
    });
  }

  // Check if category exists
  const existing = await db.query.forumCategories.findFirst({
    where: eq(forumCategories.id, id),
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Category not found',
    });
  }

  // Delete category (topics will cascade-delete)
  await db.delete(forumCategories).where(eq(forumCategories.id, id));

  return { success: true };
});
