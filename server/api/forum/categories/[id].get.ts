import { db } from '~~/server/db';
import { forumCategories, forumTopics, forumPosts } from '~~/server/db/schema';
import { eq, desc, sql, count } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Category ID is required',
    });
  }

  const category = await db.query.forumCategories.findFirst({
    where: eq(forumCategories.id, id),
    with: {
      topics: {
        orderBy: [desc(forumTopics.isPinned), desc(forumTopics.updatedAt)],
        with: {
          author: {
            columns: {
              id: true,
              username: true,
            },
          },
          posts: {
            limit: 1,
            orderBy: (posts, { desc }) => [desc(posts.createdAt)],
          },
        },
      },
    },
  });

  if (!category) {
    throw createError({
      statusCode: 404,
      message: 'Category not found',
    });
  }

  // Count replies for each topic (posts - 1, since first post is the topic itself)
  const topicIds = category.topics.map((t) => t.id);
  
  const postCounts = topicIds.length > 0 
    ? await db
        .select({
          topicId: forumPosts.topicId,
          count: count(),
        })
        .from(forumPosts)
        .where(sql`${forumPosts.topicId} IN ${topicIds}`)
        .groupBy(forumPosts.topicId)
    : [];

  const countMap = new Map(postCounts.map((p) => [p.topicId, p.count]));

  return {
    ...category,
    topics: category.topics.map((topic) => ({
      ...topic,
      replyCount: Math.max(0, (countMap.get(topic.id) || 0) - 1),
    })),
  };
});
