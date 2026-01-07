import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { validateParam, infoHashSchema } from '../../../utils/schemas';

const updateTagsSchema = z.object({
  tagIds: z.array(z.string()).max(10),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const infoHash = validateParam(event, 'hash', infoHashSchema);

  // Get torrent
  const torrent = await db.query.torrents.findFirst({
    where: eq(schema.torrents.infoHash, infoHash),
    columns: { id: true, uploaderId: true },
  });

  if (!torrent) {
    throw createError({ statusCode: 404, message: 'Torrent not found' });
  }

  // Only uploader or admin/mod can update tags
  if (torrent.uploaderId !== user.id && !user.isAdmin && !user.isModerator) {
    throw createError({ statusCode: 403, message: 'Not authorized' });
  }

  const body = await readBody(event);
  const { tagIds } = updateTagsSchema.parse(body);

  // Delete existing tags
  await db
    .delete(schema.torrentTags)
    .where(eq(schema.torrentTags.torrentId, torrent.id));

  // Insert new tags
  if (tagIds.length > 0) {
    await db.insert(schema.torrentTags).values(
      tagIds.map((tagId) => ({
        torrentId: torrent.id,
        tagId,
      }))
    );
  }

  // Fetch updated tags
  const updatedTags = await db.query.torrentTags.findMany({
    where: eq(schema.torrentTags.torrentId, torrent.id),
    with: { tag: true },
  });

  return {
    success: true,
    tags: updatedTags.map((tt) => tt.tag),
  };
});
