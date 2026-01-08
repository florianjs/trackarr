/**
 * Torznab API - Download Endpoint
 * GET /api/torznab/download?id={infoHash}&apikey={passkey}
 *
 * Downloads a torrent file with personalized announce URL
 */

import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import bencode from 'bencode';
import { authenticateTorznab } from './utils/auth';
import { TORZNAB_ERRORS, buildErrorXml } from './utils/xml';
import { rateLimit, getClientIP } from '../../utils/rateLimit';
import {
  getTorznabEnabled,
  getTorznabRateLimitOptions,
  getTorznabEnableLogging,
} from '../../utils/torznabSettings';
import {
  logTorznabRequest,
  isTorznabUserBlocked,
  trackRateLimitHit,
} from '../../utils/torznabStats';

export default defineEventHandler(async (event) => {
  const startTime = Date.now();

  // Check if Torznab API is enabled
  const enabled = await getTorznabEnabled();
  if (!enabled) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    return buildErrorXml({
      code: 900,
      description: 'Torznab API is currently disabled',
    });
  }

  // Authenticate via passkey
  let user: Awaited<ReturnType<typeof authenticateTorznab>>;
  try {
    user = await authenticateTorznab(event);
  } catch (error: any) {
    // If it's a Torznab error, return the XML directly
    if (error.isTorznab && error.data) {
      setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
      setResponseStatus(event, error.statusCode || 400);
      return error.data;
    }
    throw error;
  }

  // Check if user is blocked from Torznab API
  const blockStatus = await isTorznabUserBlocked(user.passkey);
  if (blockStatus.blocked) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    return buildErrorXml(TORZNAB_ERRORS.ACCOUNT_SUSPENDED);
  }

  // Apply dynamic rate limiting
  const rateLimitOpts = await getTorznabRateLimitOptions('download');
  try {
    await rateLimit(event, rateLimitOpts);
  } catch (error: any) {
    if (error.statusCode === 429) {
      await trackRateLimitHit(user.passkey);
    }
    throw error;
  }

  const config = useRuntimeConfig();

  const query = getQuery(event);
  const id = query.id as string | undefined;

  if (!id) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    throw createError({
      statusCode: 400,
      message: 'Missing id parameter',
      data: buildErrorXml(TORZNAB_ERRORS.MISSING_PARAMETER),
    });
  }

  // Validate info hash format
  if (!/^[a-fA-F0-9]{40}$/.test(id)) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    throw createError({
      statusCode: 400,
      message: 'Invalid info hash format',
      data: buildErrorXml(TORZNAB_ERRORS.INCORRECT_PARAMETER),
    });
  }

  const infoHash = id.toLowerCase();

  // Get torrent from DB
  const torrents = await db
    .select({
      name: schema.torrents.name,
      torrentData: schema.torrents.torrentData,
      isActive: schema.torrents.isActive,
      isApproved: schema.torrents.isApproved,
    })
    .from(schema.torrents)
    .where(eq(schema.torrents.infoHash, infoHash))
    .limit(1);

  const torrent = torrents[0];

  if (!torrent || !torrent.torrentData) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
      data: buildErrorXml({ code: 300, description: 'Torrent not found' }),
    });
  }

  // Check if torrent is active and approved
  if (!torrent.isActive || !torrent.isApproved) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    throw createError({
      statusCode: 403,
      message: 'Torrent not available',
      data: buildErrorXml(TORZNAB_ERRORS.INSUFFICIENT_PRIVILEGES),
    });
  }

  // Inject passkey into torrent data
  let decoded: any;
  try {
    decoded = bencode.decode(torrent.torrentData);
  } catch (err) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    throw createError({
      statusCode: 500,
      message: 'Failed to decode torrent file',
      data: buildErrorXml(TORZNAB_ERRORS.INTERNAL_ERROR),
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

  // Log the download request
  const loggingEnabled = await getTorznabEnableLogging();
  if (loggingEnabled) {
    const responseTime = Date.now() - startTime;
    await logTorznabRequest({
      timestamp: Date.now(),
      passkey: user.passkey,
      function: 'download',
      query: infoHash,
      ip: getClientIP(event),
      userAgent: getHeader(event, 'user-agent'),
      responseTime,
      resultCount: 1,
    });
  }

  // Set headers for download
  setHeader(event, 'Content-Type', 'application/x-bittorrent');
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
  setHeader(event, 'Content-Length', personalizedData.length);

  return personalizedData;
});
