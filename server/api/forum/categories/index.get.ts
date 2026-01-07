import { db } from '~~/server/db';
import { forumCategories } from '~~/server/db/schema';
import { asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const categories = await db.query.forumCategories.findMany({
    orderBy: [asc(forumCategories.order)],
    with: {
      topics: {
        limit: 1,
        orderBy: (topics, { desc }) => [desc(topics.updatedAt)],
      },
    },
  });

  return categories;
});
