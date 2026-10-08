import { Server as TrackerServer } from 'bittorrent-tracker';
import { handleAnnounce } from './handlers';
import { db, schema } from '../db';
import { getMinRatio } from '../utils/settings';

let server: TrackerServer | null = null;

type ScrapeCallback = (err: Error | null, response?: unknown) => void;
interface ScrapeCapableServer {
  _onScrape: (params: Record<string, unknown>, cb: ScrapeCallback) => void;
}

/**
 * bittorrent-tracker answers /scrape without running the announce filter, and
 * a scrape without info_hash lists every swarm. On a private tracker, require
 * a valid passkey and explicit hashes, and only report approved torrents.
 */
function restrictScrape(tracker: TrackerServer): void {
  const target = tracker as unknown as ScrapeCapableServer;
  const originalOnScrape = target._onScrape.bind(tracker);

  target._onScrape = (params, cb) => {
    const passkey = params.passkey;
    const hashes = params.info_hash;

    if (typeof passkey !== 'string' || !passkey) {
      return cb(new Error('Passkey required'));
    }
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return cb(new Error('info_hash required'));
    }
    if (hashes.length > 100) {
      return cb(new Error('Too many info_hash values'));
    }

    (async () => {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.passkey, passkey),
        columns: { id: true, isBanned: true },
      });
      if (!user || user.isBanned) {
        return cb(new Error('Invalid passkey'));
      }

      const requested = hashes.map((h) => String(h).toLowerCase());
      const allowed = await db.query.torrents.findMany({
        where: (t, { and, eq, inArray }) =>
          and(
            inArray(t.infoHash, requested),
            eq(t.isActive, true),
            eq(t.isApproved, true)
          ),
        columns: { infoHash: true },
      });
      const allowedSet = new Set(allowed.map((t) => t.infoHash));

      originalOnScrape(
        { ...params, info_hash: requested.filter((h) => allowedSet.has(h)) },
        cb
      );
    })().catch((err) => {
      console.error('[Tracker] Scrape error:', err);
      cb(new Error('Internal tracker error'));
    });
  };
}

// Debug mode for verbose tracker logging (set TRACKER_DEBUG=true in .env)
const TRACKER_DEBUG = process.env.TRACKER_DEBUG === 'true';

export interface TrackerConfig {
  httpPort?: number;
  udpPort?: number;
  wsPort?: number;
}

/**
 * Initialize the BitTorrent tracker server
 * Supports HTTP, UDP, and WebSocket (WebTorrent) protocols
 */
export function initTracker(config: TrackerConfig = {}): TrackerServer {
  if (server) {
    console.log('[Tracker] Already initialized');
    return server;
  }

  const httpPort =
    config.httpPort || parseInt(process.env.TRACKER_HTTP_PORT || '8080', 10);
  const udpPort =
    config.udpPort || parseInt(process.env.TRACKER_UDP_PORT || '8081', 10);
  const wsPort =
    config.wsPort || parseInt(process.env.TRACKER_WS_PORT || '8082', 10);

  server = new TrackerServer({
    http: true,
    udp: false, // Disabled for private tracker (UDP doesn't support passkeys easily)
    ws: false, // Disabled: requires node-datachannel native build
    stats: true,
    // Only trust X-Forwarded-For when a reverse proxy rewrites it (Caddy in
    // prod). Set TRACKER_TRUST_PROXY=false when the port is exposed directly.
    trustProxy: process.env.TRACKER_TRUST_PROXY !== 'false',
    filter: (
      infoHashRaw: string,
      params: any,
      cb: (err: Error | null) => void
    ) => {
      // Normalize infoHash to lowercase for consistent DB queries
      const infoHash = infoHashRaw.toLowerCase();
      const passkey = params.passkey;

      if (!passkey) {
        return cb(new Error('Passkey required'));
      }

      // Async validation
      (async () => {
        try {
          const user = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.passkey, passkey),
          });

          if (!user) {
            return cb(new Error('Invalid passkey'));
          }

          if (user.isBanned) {
            return cb(new Error('User is banned'));
          }

          const torrent = await db.query.torrents.findFirst({
            where: (t, { eq, and }) =>
              and(eq(t.infoHash, infoHash), eq(t.isActive, true)),
            columns: { id: true, isApproved: true, uploaderId: true },
          });

          const isStaff = user.isAdmin || user.isModerator;
          const isUploader = torrent?.uploaderId === user.id;

          // Pending torrents: only the uploader (to start seeding) and staff
          if (!torrent || (!torrent.isApproved && !isUploader && !isStaff)) {
            return cb(new Error('Torrent not found or inactive'));
          }

          // Ratio check. `left` is client supplied: a peer claiming left=0
          // still gets the peer list, so only trust it for peers that really
          // completed this torrent (HnR entry) or uploaded it.
          const minRatio = await getMinRatio();
          const ratio =
            user.downloaded > 0 ? user.uploaded / user.downloaded : Infinity;
          if (minRatio > 0 && ratio < minRatio && !isUploader) {
            const claimsSeeder = Number(params.left) === 0;
            const hasSnatched =
              claimsSeeder &&
              (await db.query.hnrTracking.findFirst({
                where: (h, { eq, and }) =>
                  and(eq(h.userId, user.id), eq(h.torrentId, torrent.id)),
                columns: { id: true },
              }));

            if (!hasSnatched) {
              return cb(
                new Error(
                  `Low ratio (${ratio.toFixed(2)} < ${minRatio}). Download disabled.`
                )
              );
            }
          }

          cb(null);
        } catch (err) {
          console.error('[Tracker] Filter error:', err);
          cb(new Error('Internal tracker error'));
        }
      })();
    },
  });

  restrictScrape(server);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // DEBUG: Log ALL events (only when TRACKER_DEBUG is enabled)
  if (TRACKER_DEBUG) {
    const originalEmit = server.emit.bind(server);
    server.emit = function (eventName: string, ...args: unknown[]) {
      console.log(
        `[Tracker] EVENT: ${eventName}`,
        args.map((a) => (typeof a === 'object' ? '[object]' : a)).join(', ')
      );
      return originalEmit(eventName, ...args);
    };
  }

  server.on('start', (addr: string, params: any) => {
    const infoHash = params.infoHash || params.info_hash;
    const peerId = params.peerId || params.peer_id;
    const { uploaded, downloaded, left, passkey } = params;
    const lastColon = addr.lastIndexOf(':');
    const ip = lastColon !== -1 ? addr.slice(0, lastColon) : addr;
    const port = lastColon !== -1 ? parseInt(addr.slice(lastColon + 1), 10) : 0;

    handleAnnounce({
      infoHash,
      peerId,
      ip,
      port,
      uploaded: Number(uploaded || 0),
      downloaded: Number(downloaded || 0),
      left: Number(left ?? 1),
      event: 'started',
      passkey,
    }).catch(console.error);
  });

  server.on('stop', (addr: string, params: any) => {
    const infoHash = params.infoHash || params.info_hash;
    const peerId = params.peerId || params.peer_id;
    const { uploaded, downloaded, left, passkey } = params;
    const lastColon = addr.lastIndexOf(':');
    const ip = lastColon !== -1 ? addr.slice(0, lastColon) : addr;
    const port = lastColon !== -1 ? parseInt(addr.slice(lastColon + 1), 10) : 0;

    handleAnnounce({
      infoHash,
      peerId,
      ip,
      port,
      uploaded: Number(uploaded || 0),
      downloaded: Number(downloaded || 0),
      left: Number(left || 0),
      event: 'stopped',
      passkey,
    }).catch(console.error);
  });

  server.on('complete', (addr: string, params: any) => {
    const infoHash = params.infoHash || params.info_hash;
    const peerId = params.peerId || params.peer_id;
    const { uploaded, downloaded, passkey } = params;
    const lastColon = addr.lastIndexOf(':');
    const ip = lastColon !== -1 ? addr.slice(0, lastColon) : addr;
    const port = lastColon !== -1 ? parseInt(addr.slice(lastColon + 1), 10) : 0;

    handleAnnounce({
      infoHash,
      peerId,
      ip,
      port,
      uploaded: Number(uploaded || 0),
      downloaded: Number(downloaded || 0),
      left: 0, // Seeder
      event: 'completed',
      passkey,
    }).catch(console.error);
  });

  server.on('update', (addr: string, params: any) => {
    const infoHash = params.infoHash || params.info_hash;
    const peerId = params.peerId || params.peer_id;
    const { uploaded, downloaded, left, passkey } = params;
    const lastColon = addr.lastIndexOf(':');
    const ip = lastColon !== -1 ? addr.slice(0, lastColon) : addr;
    const port = lastColon !== -1 ? parseInt(addr.slice(lastColon + 1), 10) : 0;

    handleAnnounce({
      infoHash,
      peerId,
      ip,
      port,
      uploaded: Number(uploaded || 0),
      downloaded: Number(downloaded || 0),
      left: Number(left ?? 1),
      event: 'update',
      passkey,
    }).catch(console.error);
  });

  server.on('error', (err: Error) => {
    console.error('[Tracker] Error:', err.message);
  });

  server.on('warning', (err: Error) => {
    console.warn('[Tracker] Warning:', err.message);
  });

  // ============================================================================
  // Start listening
  // ============================================================================

  server.http?.listen(httpPort, () => {
    console.log(`[Tracker] HTTP listening on port ${httpPort}`);
  });

  server.udp?.bind(udpPort, () => {
    console.log(`[Tracker] UDP listening on port ${udpPort}`);
  });

  server.ws?.listen(wsPort, () => {
    console.log(`[Tracker] WebSocket listening on port ${wsPort}`);
  });

  console.log('[Tracker] Initialized');
  return server;
}

/**
 * Get the tracker server instance
 */
export function getTracker(): TrackerServer | null {
  return server;
}

/**
 * Get swarm stats from the tracker's internal data
 * This is more reliable than Redis cache as it reflects real-time state
 */
export function getSwarmStats(infoHash: string): {
  seeders: number;
  leechers: number;
} {
  if (!server) {
    return { seeders: 0, leechers: 0 };
  }

  try {
    // bittorrent-tracker stores swarms by infoHash
    const swarm = server.getSwarm(infoHash);
    if (!swarm) {
      return { seeders: 0, leechers: 0 };
    }

    return {
      seeders: swarm.complete || 0,
      leechers: swarm.incomplete || 0,
    };
  } catch (err) {
    console.error('[Tracker] Error getting swarm stats:', err);
    return { seeders: 0, leechers: 0 };
  }
}

/**
 * Stop the tracker server
 */
export async function stopTracker(): Promise<void> {
  if (server) {
    return new Promise((resolve) => {
      server!.close(() => {
        console.log('[Tracker] Stopped');
        server = null;
        resolve();
      });
    });
  }
}
