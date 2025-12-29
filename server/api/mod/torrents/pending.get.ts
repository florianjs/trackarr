import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { eq, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  // Get all pending (unapproved) torrents
  const pendingTorrents = await db.query.torrents.findMany({
    where: eq(schema.torrents.isApproved, false),
    with: {
      uploader: {
        columns: {
          id: true,
          username: true,
        },
      },
      category: true,
    },
    orderBy: [desc(schema.torrents.createdAt)],
  });

  return pendingTorrents;
});
