import { db } from '~~/server/db';
import { forumPosts, forumTopics } from '~~/server/db/schema';
import { eq, count } from 'drizzle-orm';
import { requireAuthSession } from '~~/server/utils/adminAuth';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Post ID is required',
    });
  }

  const post = await db.query.forumPosts.findFirst({
    where: eq(forumPosts.id, id),
  });

  if (!post) {
    throw createError({
      statusCode: 404,
      message: 'Post not found',
    });
  }

  // Check permissions: Author, Moderator, or Admin
  const isAuthor = post.authorId === session.user.id;
  const isModerator = session.user.isModerator || session.user.isAdmin;

  if (!isAuthor && !isModerator) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to delete this post',
    });
  }

  // Check if it's the first post of the topic
  const firstPost = await db.query.forumPosts.findFirst({
    where: eq(forumPosts.topicId, post.topicId),
    orderBy: (posts, { asc }) => [asc(posts.createdAt)],
  });

  if (firstPost?.id === id) {
    // If it's the first post, delete the whole topic
    await db.delete(forumTopics).where(eq(forumTopics.id, post.topicId));
    return { message: 'Topic deleted (first post removed)' };
  }

  // Check if it's the only post in the topic (fallback, though firstPost check covers it)
  const postCount = await db
    .select({ value: count() })
    .from(forumPosts)
    .where(eq(forumPosts.topicId, post.topicId));

  if (postCount[0].value <= 1) {
    await db.delete(forumTopics).where(eq(forumTopics.id, post.topicId));
    return { message: 'Topic deleted as it was the last post' };
  }

  await db.delete(forumPosts).where(eq(forumPosts.id, id));

  return { message: 'Post deleted' };
});
