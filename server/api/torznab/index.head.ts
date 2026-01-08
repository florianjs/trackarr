/**
 * Torznab API - HEAD handler
 * HEAD /api/torznab
 *
 * Returns proper headers for HEAD requests (used by Prowlarr/Sonarr/Radarr to test connection)
 * Without this, Nuxt SSR middleware intercepts HEAD requests and redirects to login
 */

import { getTorznabEnabled } from '../../utils/torznabSettings';

export default defineEventHandler(async (event) => {
  // Check if Torznab API is enabled
  const enabled = await getTorznabEnabled();

  if (!enabled) {
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    setResponseStatus(event, 503);
    return '';
  }

  // Return headers that indicate this is a valid Torznab endpoint
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=3600');
  setResponseStatus(event, 200);
  return '';
});
