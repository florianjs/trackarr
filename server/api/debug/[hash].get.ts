import { getPeers, getStats } from '../../redis/cache';
import { requireAdmin } from '../../utils/auth';

// Debug endpoint to check Redis state directly
// Admin only - contains sensitive peer data
export default defineEventHandler(async (event) => {
  // Require admin authentication
  requireAdmin(event);

  const hash = getRouterParam(event, 'hash');

  if (!hash) {
    throw createError({ statusCode: 400, message: 'Hash required' });
  }

  const infoHash = hash.toLowerCase();

  const [stats, peers] = await Promise.all([
    getStats(infoHash),
    getPeers(infoHash),
  ]);

  // Even for admin, only show hashed IPs
  const sanitizedPeers = peers.map((p) => ({
    peerId: p.peerId.slice(0, 8) + '...',
    ipHash: p.ipHash,
    port: p.port,
    isSeeder: p.isSeeder,
    uploaded: p.uploaded,
    downloaded: p.downloaded,
    updatedAt: p.updatedAt,
  }));

  return {
    infoHash,
    stats,
    peers: sanitizedPeers,
    timestamp: new Date().toISOString(),
  };
});
