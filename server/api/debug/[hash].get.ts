import { getPeers, getStats } from '../../redis/cache';
import { requireAdminSession } from '../../utils/adminAuth';

// Debug endpoint to check Redis state directly
// Admin only - contains sensitive peer data
export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdminSession(event);

  const hash = getRouterParam(event, 'hash');

  if (!hash || !/^[a-fA-F0-9]{40}$/.test(hash)) {
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
