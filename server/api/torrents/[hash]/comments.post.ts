import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { torrents, torrentComments } from '../../../db/schema';
import { requireAuthSession } from '../../../utils/adminAuth';
import {
  validateParam,
  validateBody,
  infoHashSchema,
  torrentCommentSchema,
} from '../../../utils/schemas';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);

  // Validate hash parameter
  const hash = validateParam(event, 'hash', infoHashSchema);

  // Validate request body
  const body = await validateBody(event, torrentCommentSchema);

  // Find torrent by hash to get its UUID
  const torrent = await db.query.torrents.findFirst({
    where: eq(torrents.infoHash, hash.toLowerCase()),
  });

  if (!torrent) {
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
