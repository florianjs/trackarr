import { checkProtocolHealth } from '../utils/protocolHealthCheck';

/**
 * GET /api/tracker-status
 * Lightweight endpoint to check if tracker is online
 * Used for real-time status indicators on homepage and admin panel
 */
export default defineEventHandler(async () => {
  const protocols = await checkProtocolHealth();
  
  return {
    online: protocols.http || protocols.udp || protocols.ws,
    protocols,
  };
});
