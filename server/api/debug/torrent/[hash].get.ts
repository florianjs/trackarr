import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import bencode from 'bencode';

/**
 * Debug endpoint to inspect torrent file content
 * GET /api/debug/torrent/[hash]
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const config = useRuntimeConfig();

  const hash = getRouterParam(event, 'hash');

  if (!hash || !/^[a-fA-F0-9]{40}$/.test(hash)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid info hash format',
    });
  }

  const infoHash = hash.toLowerCase();

  // Get torrent from DB
  const torrents = await db
    .select({
      name: schema.torrents.name,
      torrentData: schema.torrents.torrentData,
    })
    .from(schema.torrents)
    .where(eq(schema.torrents.infoHash, infoHash))
    .limit(1);

  const torrent = torrents[0];

  if (!torrent || !torrent.torrentData) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  // Decode original torrent
  let decoded: any;
  try {
    decoded = bencode.decode(torrent.torrentData);
  } catch (err) {
    throw createError({
      statusCode: 500,
      message: 'Failed to decode torrent file',
    });
  }

  const originalAnnounce = decoded.announce?.toString?.() || null;
  const originalAnnounceList = decoded['announce-list']?.map((tier: any[]) =>
    tier.map((url: Buffer) => url.toString())
  );
  const originalPrivate = decoded.info?.private;

  // Generate personalized URL
  const trackerUrl = new URL(config.public.trackerHttpUrl as string);
  trackerUrl.searchParams.set('passkey', user.passkey);
  const personalizedUrl = trackerUrl.toString();

  // Simulate what download does
  decoded.announce = Buffer.from(personalizedUrl);
  if (decoded['announce-list']) {
    decoded['announce-list'] = [[Buffer.from(personalizedUrl)]];
  }
  if (decoded.info) {
    decoded.info.private = 1;
  }

  const personalizedData = bencode.encode(decoded);
  const reDecoded = bencode.decode(personalizedData);

  return {
    debug: {
      infoHash,
      torrentName: torrent.name,
      userPasskey: user.passkey,
      trackerBaseUrl: config.public.trackerHttpUrl,
    },
    original: {
      announce: originalAnnounce,
      announceList: originalAnnounceList,
      private: originalPrivate,
    },
    personalized: {
      announce: reDecoded.announce?.toString?.() || null,
      announceList: reDecoded['announce-list']?.map((tier: any[]) =>
        tier.map((url: Buffer) => url.toString())
      ),
      private: reDecoded.info?.private,
    },
    passkeysPresent: {
      inAnnounce: personalizedUrl.includes('passkey='),
      inEncodedAnnounce: reDecoded.announce?.toString?.().includes('passkey='),
    },
  };
});
