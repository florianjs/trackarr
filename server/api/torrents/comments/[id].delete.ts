import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { torrentComments } from '../../../db/schema';
import { requireAuthSession } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const commentId = getRouterParam(event, 'id');

  if (!commentId) {
    throw createError({
      statusCode: 400,
      message: 'Comment ID is required',
    });
  }

  const [comment] = await db
    .select()
    .from(torrentComments)
    .where(eq(torrentComments.id, commentId))
    .limit(1);

  if (!comment) {
    throw createError({
      statusCode: 404,
      message: 'Comment not found',
    });
  }

  // Check permissions: Author, Moderator, or Admin
  const isAuthor = comment.authorId === session.user.id;
  const isModerator = session.user.isModerator || session.user.isAdmin;

  if (!isAuthor && !isModerator) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to delete this comment',
    });
  }

  await db.delete(torrentComments).where(eq(torrentComments.id, commentId));

  return { success: true };
});
