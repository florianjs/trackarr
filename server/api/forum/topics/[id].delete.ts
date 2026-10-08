import { db } from '~~/server/db';
import { forumPosts, forumTopics } from '~~/server/db/schema';
import { and, count, eq, ne } from 'drizzle-orm';
import { requireAuthSession } from '~~/server/utils/adminAuth';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Topic ID is required',
    });
  }

  const topic = await db.query.forumTopics.findFirst({
    where: eq(forumTopics.id, id),
  });

  if (!topic) {
    throw createError({
      statusCode: 404,
      message: 'Topic not found',
    });
  }

  // Check permissions: Author, Moderator, or Admin
  const isAuthor = topic.authorId === session.user.id;
  const isModerator = session.user.isModerator || session.user.isAdmin;

  if (!isAuthor && !isModerator) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to delete this topic',
    });
  }

  // Deleting a topic cascades to every post: authors may only do that while
  // the topic is unlocked and nobody else has replied
  if (!isModerator) {
    const [otherReplies] = await db
      .select({ value: count() })
      .from(forumPosts)
      .where(and(eq(forumPosts.topicId, id), ne(forumPosts.authorId, session.user.id)));

    if (topic.isLocked || otherReplies!.value > 0) {
      throw createError({
        statusCode: 403,
        message: 'Cannot delete a locked topic or one with replies from other users',
      });
    }
  }

  await db.delete(forumTopics).where(eq(forumTopics.id, id));

  return { message: 'Topic deleted' };
});
