import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { getPeers, getStats } from '../../redis/cache';
import { validateParam, infoHashSchema } from '../../utils/schemas';

export default defineEventHandler(async (event) => {
  // Require authentication
  await requireUserSession(event);

  // Validate info hash parameter
  const infoHash = validateParam(event, 'hash', infoHashSchema);

  // Get torrent from DB
  const torrent = await db.query.torrents.findFirst({
    where: (t, { eq }) => eq(t.infoHash, infoHash),
    with: {
      category: true,
      torrentTags: {
        with: {
          tag: true,
        },
      },
      comments: {
        with: {
          author: {
            columns: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      },
    },
  });

  if (!torrent) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  // Get live data from Redis
  const [stats, peers] = await Promise.all([
    getStats(infoHash),
    getPeers(infoHash),
  ]);

  // Extract tags from torrentTags relation
  const tags = torrent.torrentTags?.map((tt) => tt.tag) || [];

  return {
    ...torrent,
    tags,
    torrentTags: undefined, // Remove the junction table data
    stats: {
      seeders: stats.seeders,
      leechers: stats.leechers,
      completed: stats.completed,
    },
    // Only expose anonymized peer data - no raw IPs
    peers: peers.map((p) => ({
      id: p.ipHash, // Use hashed IP as identifier
      port: p.port,
      isSeeder: p.isSeeder,
      uploaded: p.uploaded,
      downloaded: p.downloaded,
      lastSeen: new Date(p.updatedAt).toISOString(),
    })),
  };
});
