import { db } from '~~/server/db';
import { forumTopics, forumPosts } from '~~/server/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { validateBody, forumTopicSchema } from '~~/server/utils/schemas';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  // Validate request body with Zod
  const body = await validateBody(event, forumTopicSchema);

  const topicId = uuidv4();
  const postId = uuidv4();

  return await db.transaction(async (tx) => {
    const topic = await tx
      .insert(forumTopics)
      .values({
        id: topicId,
        categoryId: body.categoryId,
        authorId: session.user.id,
        title: body.title,
      })
      .returning();

    await tx.insert(forumPosts).values({
      id: postId,
      topicId: topicId,
      authorId: session.user.id,
      content: body.content,
    });

    return topic[0];
  });
});
