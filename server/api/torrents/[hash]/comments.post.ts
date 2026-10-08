import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { torrents, torrentComments } from '../../../db/schema';
import { requireAuthSession } from '../../../utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import {
  validateParam,
  validateBody,
  infoHashSchema,
  torrentCommentSchema,
} from '../../../utils/schemas';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  await rateLimit(event, RATE_LIMITS.mutation);

  // Validate hash parameter
  const hash = validateParam(event, 'hash', infoHashSchema);

  // Validate request body
  const body = await validateBody(event, torrentCommentSchema);

  // Find torrent by hash to get its UUID
  const torrent = await db.query.torrents.findFirst({
    where: eq(torrents.infoHash, hash.toLowerCase()),
  });

  // Pending torrents are only visible to their uploader and staff
  const canSee =
    torrent &&
    (torrent.isApproved ||
      torrent.uploaderId === session.user.id ||
      session.user.isAdmin ||
      session.user.isModerator);

  if (!torrent || !canSee) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  const comment = await db
    .insert(torrentComments)
    .values({
      id: crypto.randomUUID(),
      torrentId: torrent.id,
      authorId: session.user.id,
      content: body.content,
    })
    .returning();

  return comment[0];
});
