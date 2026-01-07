import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdminSession(event);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Category ID is required',
    });
  }

  // Check if there are torrents in this category
  const torrentCount = await db.query.torrents.findFirst({
    where: (t, { eq }) => eq(t.categoryId, id),
  });

  if (torrentCount) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete category with torrents',
    });
  }

  // Check if this category has subcategories
  const subcategory = await db.query.categories.findFirst({
    where: eq(schema.categories.parentId, id),
  });

  if (subcategory) {
    throw createError({
      statusCode: 400,
      message:
        'Cannot delete category with subcategories. Delete subcategories first.',
    });
  }

  await db.delete(schema.categories).where(eq(schema.categories.id, id));

  return { success: true };
});
