import { db } from '~~/server/db';
import { forumPosts, forumTopics } from '~~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { validateBody, forumPostSchema } from '~~/server/utils/schemas';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  // Validate request body with Zod
  const body = await validateBody(event, forumPostSchema);

  const topic = await db.query.forumTopics.findFirst({
    where: eq(forumTopics.id, body.topicId),
  });

  if (!topic) {
    throw createError({
      statusCode: 404,
      message: 'Topic not found',
    });
  }

  if (topic.isLocked && !session.user.isAdmin && !session.user.isModerator) {
    throw createError({
      statusCode: 403,
      message: 'Topic is locked',
    });
  }

  return await db.transaction(async (tx) => {
    const post = await tx
      .insert(forumPosts)
      .values({
        id: uuidv4(),
        topicId: body.topicId,
        authorId: session.user.id,
        content: body.content,
      })
      .returning();

    // Update topic's updatedAt timestamp
    await tx
      .update(forumTopics)
      .set({ updatedAt: new Date() })
      .where(eq(forumTopics.id, body.topicId));

    return post[0];
  });
});
