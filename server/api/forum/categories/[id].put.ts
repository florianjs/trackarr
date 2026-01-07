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

  const body = await readBody(event);

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

  // Update category
  const updated = await db
    .update(forumCategories)
    .set({
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      order: body.order ?? existing.order,
    })
    .where(eq(forumCategories.id, id))
    .returning();

  return updated[0];
});
