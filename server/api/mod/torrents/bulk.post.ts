import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { redis } from '~~/server/redis/client';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { awardUploadBonus } from '~~/server/utils/bonus';
import { rateLimit, RATE_LIMITS } from '~~/server/utils/rateLimit';
import { validateBody } from '~~/server/utils/schemas';
import { invalidateTrackerTorrent, invalidateTrackerTorrents } from '~~/server/tracker/client';
import { torrentBulkSchema } from '~~/shared/utils/bulk';

/**
 * POST /api/mod/torrents/bulk
 * Approve, delete or recategorise a selection of torrents at once (staff).
 * Returns how many rows were really changed: already approved or already
 * deleted torrents are skipped.
 */
export default defineEventHandler(async (event) => {
  await rateLimit(event, RATE_LIMITS.mutation);
  await requireModeratorSession(event);
  const body = await validateBody(event, torrentBulkSchema);
  const inSelection = inArray(schema.torrents.infoHash, body.infoHashes);

  switch (body.action) {
    case 'approve': {
      // Only pending ones: approving twice must not touch anything
      const approved = await db
        .update(schema.torrents)
        .set({ isApproved: true })
        .where(and(inSelection, eq(schema.torrents.isApproved, false)))
        .returning({
          id: schema.torrents.id,
          infoHash: schema.torrents.infoHash,
          name: schema.torrents.name,
          uploaderId: schema.torrents.uploaderId,
        });

      for (const torrent of approved) {
        await awardUploadBonus(db, torrent).catch((err) => console.error('[Bonus] Upload bonus failed:', err));
      }
      invalidateTrackerTorrents();
      return { action: body.action, count: approved.length };
    }

    case 'delete': {
      const deleted = await db
        .delete(schema.torrents)
        .where(inSelection)
        .returning({ infoHash: schema.torrents.infoHash });

      if (deleted.length) {
        try {
          await redis.del(...deleted.map((t) => `stats:${t.infoHash}`));
        } catch {
          // Redis errors are non-fatal, the stats expire on their own
        }
      }
      // The tracker caches rows for a few seconds and holds swarms in memory
      for (const t of deleted) invalidateTrackerTorrent(t.infoHash);
      return { action: body.action, count: deleted.length };
    }

    case 'category': {
      if (body.categoryId) {
        const category = await db.query.categories.findFirst({
          where: eq(schema.categories.id, body.categoryId),
          columns: { id: true },
        });
        if (!category) throw createError({ statusCode: 400, message: 'Invalid category' });
      }

      const updated = await db
        .update(schema.torrents)
        .set({ categoryId: body.categoryId })
        .where(inSelection)
        .returning({ id: schema.torrents.id });
      invalidateTrackerTorrents();
      return { action: body.action, count: updated.length };
    }
  }
});
