import { z } from 'zod';
import { validateQuery } from '../../../../utils/schemas';
import {
  getChannelVersion,
  loadShouts,
  requireReadableChannel,
  requireShoutViewer,
} from '../../../../utils/shoutbox';

const querySchema = z.object({
  // Version the client already has: answer without messages if unchanged
  v: z.string().max(16).optional(),
  before: z.iso.datetime().optional(),
});

/**
 * GET /api/shoutbox/channels/:id/messages
 * Latest messages (oldest first), or older ones with ?before=. Polled with
 * ?v= so an unchanged channel costs one Redis read.
 */
export default defineEventHandler(async (event) => {
  const viewer = await requireShoutViewer(event);
  const channel = await requireReadableChannel(event, viewer);
  const query = validateQuery(event, querySchema);

  if (query.before) {
    return { version: null, ...(await loadShouts(channel, viewer, new Date(query.before))) };
  }

  const version = await getChannelVersion(channel.id);
  if (version !== null && query.v === version) {
    return { version, unchanged: true as const };
  }
  return { version, ...(await loadShouts(channel, viewer)) };
});
