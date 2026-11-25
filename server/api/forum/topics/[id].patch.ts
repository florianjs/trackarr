import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '~~/server/db';
import { forumCategories, forumTopics } from '~~/server/db/schema';
import { validateBody, validateParam, uuidSchema } from '~~/server/utils/schemas';
import { filterPublicText } from '~~/server/utils/slurFilter';
import { canEditContent, canMoveTopic } from '~~/shared/utils/contentRights';

const editSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    categoryId: z.uuid('Invalid category ID').optional(),
  })
  .refine((v) => v.title !== undefined || v.categoryId !== undefined, { message: 'Nothing to change' });

/**
 * PATCH /api/forum/topics/:id
 * Rename a topic (author while unlocked, or staff) or move it to another
 * category (staff)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  const body = await validateBody(event, editSchema);

  const topic = await db.query.forumTopics.findFirst({ where: eq(forumTopics.id, id) });
  if (!topic) throw createError({ statusCode: 404, message: 'Topic not found' });

  if (!canEditContent(user, topic, { locked: topic.isLocked })) {
    throw createError({ statusCode: 403, message: 'You cannot edit this topic' });
  }
  if (body.categoryId !== undefined && body.categoryId !== topic.categoryId) {
    if (!canMoveTopic(user)) {
      throw createError({ statusCode: 403, message: 'Only staff can move a topic' });
    }
    const category = await db.query.forumCategories.findFirst({
      where: eq(forumCategories.id, body.categoryId),
      columns: { id: true },
    });
    if (!category) throw createError({ statusCode: 404, message: 'Category not found' });
  }

  const [updated] = await db
    .update(forumTopics)
    .set({
      ...(body.title !== undefined && { title: await filterPublicText(body.title) }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
    })
    .where(eq(forumTopics.id, id))
    .returning();
  return updated;
});
