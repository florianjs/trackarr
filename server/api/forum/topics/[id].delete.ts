import { db } from '~~/server/db';
import { forumTopics } from '~~/server/db/schema';
import { eq } from 'drizzle-orm';
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

  await db.delete(forumTopics).where(eq(forumTopics.id, id));

  return { message: 'Topic deleted' };
});
