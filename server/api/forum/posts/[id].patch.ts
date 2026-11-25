import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '~~/server/db';
import { forumPosts, forumTopics } from '~~/server/db/schema';
import { validateBody, validateParam, uuidSchema } from '~~/server/utils/schemas';
import { filterPublicText } from '~~/server/utils/slurFilter';
import { canEditContent } from '~~/shared/utils/contentRights';

const editSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(50000),
});

/**
 * PATCH /api/forum/posts/:id
 * Edit a post: its author (topic not locked) or staff
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  const body = await validateBody(event, editSchema);

  const [post] = await db
    .select({ authorId: forumPosts.authorId, isLocked: forumTopics.isLocked })
    .from(forumPosts)
    .innerJoin(forumTopics, eq(forumTopics.id, forumPosts.topicId))
    .where(eq(forumPosts.id, id))
    .limit(1);
  if (!post) throw createError({ statusCode: 404, message: 'Post not found' });

  if (!canEditContent(user, post, { locked: post.isLocked })) {
    throw createError({ statusCode: 403, message: 'You cannot edit this post' });
  }

  const [updated] = await db
    .update(forumPosts)
    .set({ content: await filterPublicText(body.content), updatedAt: new Date() })
    .where(eq(forumPosts.id, id))
    .returning();
  return updated;
});
