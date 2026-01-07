import { db } from '~~/server/db';
import { forumTopics } from '~~/server/db/schema';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Topic ID is required',
    });
  }

  const topic = await db
    .update(forumTopics)
    .set({ isPinned: !!body.isPinned })
    .where(eq(forumTopics.id, id))
    .returning();

  return topic[0];
});
