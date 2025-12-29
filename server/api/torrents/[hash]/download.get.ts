import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import bencode from 'bencode';

export default defineEventHandler(async (event) => {
  // Require authentication
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

  // Inject passkey into torrent data
  let decoded: any;
  try {
    decoded = bencode.decode(torrent.torrentData);
  } catch (err) {
    throw createError({
      statusCode: 500,
      message: 'Failed to decode torrent file',
    });
  }

  // Personalize announce URL
  const trackerUrl = new URL(config.public.trackerHttpUrl as string);
  trackerUrl.searchParams.set('passkey', user.passkey);
  const personalizedUrl = trackerUrl.toString();

  decoded.announce = Buffer.from(personalizedUrl);

  // Also update announce-list if it exists
  if (decoded['announce-list']) {
    decoded['announce-list'] = [[Buffer.from(personalizedUrl)]];
  }

  // Set private flag to 1
  if (decoded.info) {
    decoded.info.private = 1;
  }

  const personalizedData = bencode.encode(decoded);

  // Sanitize filename
  const filename = torrent.name.replace(/[^a-zA-Z0-9._-]/g, '_') + '.torrent';

  // Set headers for download
  setHeader(event, 'Content-Type', 'application/x-bittorrent');
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
  setHeader(event, 'Content-Length', personalizedData.length);

  return personalizedData;
});
