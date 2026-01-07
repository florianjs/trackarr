import { db, schema } from '../../db';
import { asc, isNull } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  // Require authentication
  await requireUserSession(event);

  // Fetch all categories with their subcategories
  const allCategories = await db.query.categories.findMany({
    orderBy: [asc(schema.categories.name)],
    with: {
      subcategories: {
        orderBy: [asc(schema.categories.name)],
      },
    },
  });

  // Return only root categories (parentId is null), subcategories are nested
  const rootCategories = allCategories.filter((c) => c.parentId === null);

  return rootCategories;
});
