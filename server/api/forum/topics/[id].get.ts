import { db } from '~~/server/db';
import { forumTopics, forumPosts } from '~~/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Topic ID is required',
    });
  }

  const topic = await db.query.forumTopics.findFirst({
    where: eq(forumTopics.id, id),
    with: {
      category: true,
      author: {
        columns: {
          id: true,
          username: true,
          isAdmin: true,
          isModerator: true,
        },
      },
      posts: {
        orderBy: [asc(forumPosts.createdAt)],
        with: {
          author: {
            columns: {
              id: true,
              username: true,
              isAdmin: true,
              isModerator: true,
            },
          },
        },
      },
    },
  });

  if (!topic) {
    throw createError({
      statusCode: 404,
      message: 'Topic not found',
    });
  }

  return topic;
});
