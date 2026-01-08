/**
 * Torznab API - Main Router
 * GET /api/torznab?t={function}&apikey={passkey}&...
 *
 * Handles all Torznab functions:
 * - caps: Capabilities
 * - search: General search
 * - tvsearch: TV-specific search
 * - movie: Movie-specific search
 */

import type { H3Event } from 'h3';
import { z } from 'zod';
import { db, schema } from '../../db';
import { getStats } from '../../redis/cache';
import { desc, eq, ilike, and, inArray } from 'drizzle-orm';
import { authenticateTorznab, sendTorznabError } from './utils/auth';
import {
  buildCapsXml,
  buildSearchXml,
  TORZNAB_ERRORS,
  type TorznabItem,
} from './utils/xml';
import {
  buildCategoryTree,
  filterCategoriesByNewznab,
  getNewznabCategoryId,
} from './utils/categories';
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

// Query schema for Torznab requests
const torznabQuerySchema = z.object({
  t: z.string().default('search'),
  apikey: z.string().optional(),
  q: z.string().optional(),
  cat: z.string().optional(), // Comma-separated category IDs
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
  // TV search params
  season: z.string().optional(),
  ep: z.string().optional(),
  tvdbid: z.string().optional(),
  // Movie search params
  imdbid: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const startTime = Date.now();

  // Check if Torznab API is enabled
  const enabled = await getTorznabEnabled();
  if (!enabled) {
    return sendTorznabError(event, {
      code: 900,
      description: 'Torznab API is currently disabled',
    });
  }

  // Parse query parameters
  const rawQuery = getQuery(event);
  const parseResult = torznabQuerySchema.safeParse(rawQuery);

  if (!parseResult.success) {
    return sendTorznabError(event, TORZNAB_ERRORS.INCORRECT_PARAMETER);
  }

  const query = parseResult.data;
  const func = query.t.toLowerCase();

  // Capabilities don't require authentication
  if (func === 'caps') {
    return handleCaps(event);
  }

  // All other functions require authentication
  // Wrap in try/catch to handle Torznab XML errors properly
  let user: { passkey: string };
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
    return sendTorznabError(
      event,
      TORZNAB_ERRORS.ACCOUNT_SUSPENDED,
      blockStatus.reason
    );
  }

  // Apply dynamic rate limiting based on settings
  const rateLimitOpts = await getTorznabRateLimitOptions('search');
  try {
    await rateLimit(event, rateLimitOpts);
  } catch (error: any) {
    if (error.statusCode === 429) {
      await trackRateLimitHit(user.passkey);
    }
    throw error;
  }

  let result: string;
  let resultCount = 0;
  let errorMsg: string | undefined;

  try {
    switch (func) {
      case 'search':
        result = await handleSearch(event, query, user);
        break;
      case 'tvsearch':
        result = await handleTvSearch(event, query, user);
        break;
      case 'movie':
        result = await handleMovieSearch(event, query, user);
        break;
      default:
        return sendTorznabError(
          event,
          TORZNAB_ERRORS.NO_SUCH_FUNCTION,
          `Unknown function: ${func}`
        );
    }
  } catch (error: any) {
    errorMsg = error.message || 'Unknown error';
    throw error;
  } finally {
    // Log the request if logging is enabled
    const loggingEnabled = await getTorznabEnableLogging();
    if (loggingEnabled) {
      const responseTime = Date.now() - startTime;
      await logTorznabRequest({
        timestamp: Date.now(),
        passkey: user.passkey,
        function: func,
        query: query.q,
        ip: getClientIP(event),
        userAgent: getHeader(event, 'user-agent'),
        responseTime,
        resultCount,
        error: errorMsg,
      });
    }
  }

  return result;
});

/**
 * Handle t=caps - Return capabilities
 */
async function handleCaps(event: H3Event) {
  const categories = await buildCategoryTree();

  const xml = buildCapsXml({
    serverVersion: '1.0',
    serverTitle: 'Trackarr',
    maxLimit: 100,
    defaultLimit: 25,
    categories,
  });

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  return xml;
}

/**
 * Handle t=search - General search
 */
async function handleSearch(
  event: H3Event,
  query: z.infer<typeof torznabQuerySchema>,
  user: { passkey: string }
) {
  return performSearch(event, query, user);
}

/**
 * Handle t=tvsearch - TV-specific search
 * Supports season/episode parsing
 */
async function handleTvSearch(
  event: H3Event,
  query: z.infer<typeof torznabQuerySchema>,
  user: { passkey: string }
) {
  // Build search query with season/episode
  let searchQuery = query.q || '';

  if (query.season) {
    // Format: S01 or S1
    const seasonNum = parseInt(query.season, 10);
    if (!isNaN(seasonNum)) {
      const seasonStr = `S${seasonNum.toString().padStart(2, '0')}`;
      searchQuery += ` ${seasonStr}`;
    }
  }

  if (query.ep) {
    // Format: E01 or E1
    const epNum = parseInt(query.ep, 10);
    if (!isNaN(epNum)) {
      const epStr = `E${epNum.toString().padStart(2, '0')}`;
      searchQuery += epStr; // No space, directly after season
    }
  }

  // Force TV categories if none specified
  if (!query.cat) {
    query.cat = '5000'; // TV main category
  }

  return performSearch(event, { ...query, q: searchQuery.trim() }, user);
}

/**
 * Handle t=movie - Movie-specific search
 * Supports IMDB ID
 */
async function handleMovieSearch(
  event: H3Event,
  query: z.infer<typeof torznabQuerySchema>,
  user: { passkey: string }
) {
  let searchQuery = query.q || '';

  // IMDB ID support - for now, just include it in search
  // Full support would require IMDB field in torrents table
  if (query.imdbid) {
    // Clean IMDB ID format (tt1234567 -> 1234567)
    const imdbNum = query.imdbid.replace(/^tt/i, '');
    searchQuery += ` ${imdbNum}`;
  }

  // Force Movie categories if none specified
  if (!query.cat) {
    query.cat = '2000'; // Movies main category
  }

  return performSearch(event, { ...query, q: searchQuery.trim() }, user);
}

/**
 * Perform the actual search and return Torznab XML
 */
async function performSearch(
  event: H3Event,
  query: z.infer<typeof torznabQuerySchema>,
  user: { passkey: string }
) {
  const baseUrl = getRequestURL(event).origin;
  const conditions = [];

  // Only show active, approved torrents
  conditions.push(eq(schema.torrents.isActive, true));
  conditions.push(eq(schema.torrents.isApproved, true));

  // Text search
  if (query.q) {
    const terms = query.q.split(/\s+/).filter((t) => t.length > 0);
    if (terms.length > 0) {
      conditions.push(
        and(...terms.map((term) => ilike(schema.torrents.name, `%${term}%`)))
      );
    }
  }

  // Category filter
  if (query.cat) {
    const newznabIds = query.cat
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    if (newznabIds.length > 0) {
      const trackarrCatIds = await filterCategoriesByNewznab(newznabIds);
      if (trackarrCatIds.length > 0) {
        conditions.push(inArray(schema.torrents.categoryId, trackarrCatIds));
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch torrents
  const torrents = await db.query.torrents.findMany({
    where: whereClause,
    with: {
      category: true,
    },
    orderBy: [desc(schema.torrents.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });

  // Enrich with stats from Redis
  const items: TorznabItem[] = await Promise.all(
    torrents.map(async (torrent) => {
      const stats = await getStats(torrent.infoHash);
      const newznabCatId = getNewznabCategoryId(torrent.category);

      return {
        title: torrent.name,
        guid: torrent.infoHash,
        link: `${baseUrl}/torrents/${torrent.infoHash}`,
        commentsUrl: `${baseUrl}/torrents/${torrent.infoHash}`,
        pubDate: new Date(torrent.createdAt),
        size: torrent.size,
        description: torrent.description ?? undefined,
        categoryName: torrent.category?.name,
        categoryId: newznabCatId,
        seeders: stats.seeders,
        leechers: stats.leechers,
        grabs: stats.completed,
        downloadUrl: `${baseUrl}/api/torznab/download?id=${torrent.infoHash}&apikey=${user.passkey}`,
        downloadVolumeFactor: 1, // Could be enhanced with freeleech support
        uploadVolumeFactor: 1,
      };
    })
  );

  const xml = buildSearchXml({
    title: 'Trackarr',
    description: 'Trackarr Torznab Feed',
    link: baseUrl,
    selfUrl: `${baseUrl}/api/torznab`,
    items,
  });

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return xml;
}
