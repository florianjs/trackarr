import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { torrentComments } from '~~/server/db/schema';
import { torrentCommentSchema, validateBody, validateParam, uuidSchema } from '~~/server/utils/schemas';
import { filterPublicText } from '~~/server/utils/slurFilter';
import { canEditContent } from '~~/shared/utils/contentRights';

/**
 * PATCH /api/torrents/comments/:id
 * Edit a comment: its author or staff
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  const body = await validateBody(event, torrentCommentSchema);

  const comment = await db.query.torrentComments.findFirst({
    where: eq(torrentComments.id, id),
    columns: { authorId: true },
  });
  if (!comment) throw createError({ statusCode: 404, message: 'Comment not found' });
  if (!canEditContent(user, comment)) {
    throw createError({ statusCode: 403, message: 'You cannot edit this comment' });
  }

  const [updated] = await db
    .update(torrentComments)
    .set({ content: await filterPublicText(body.content.trim()), updatedAt: new Date() })
    .where(eq(torrentComments.id, id))
    .returning();
  return updated;
});
