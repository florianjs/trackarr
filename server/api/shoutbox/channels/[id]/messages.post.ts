import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db, schema } from '../../../../db';
import { rateLimit, RATE_LIMITS } from '../../../../utils/rateLimit';
import { validateBody } from '../../../../utils/schemas';
import {
  bumpChannelVersion,
  getMutedUntil,
  requireReadableChannel,
  requireShoutViewer,
} from '../../../../utils/shoutbox';
import { canWriteChannel, normalizeShout, MAX_SHOUT_LENGTH } from '../../../../utils/shoutboxRules';

const bodySchema = z.object({ body: z.string().max(MAX_SHOUT_LENGTH * 2) });

/**
 * POST /api/shoutbox/channels/:id/messages
 */
export default defineEventHandler(async (event) => {
  const viewer = await requireShoutViewer(event);
  const channel = await requireReadableChannel(event, viewer);
  if (!canWriteChannel(channel, viewer)) {
    throw createError({ statusCode: 403, message: 'You cannot post in this channel' });
  }
  await rateLimit(event, RATE_LIMITS.shout);

  const mutedUntil = await getMutedUntil(viewer.id);
  if (mutedUntil) {
    throw createError({ statusCode: 403, message: 'You are muted in the shoutbox', data: { mutedUntil } });
  }

  const { body: raw } = await validateBody(event, bodySchema);
  const body = normalizeShout(raw);
  if (!body) {
    throw createError({ statusCode: 400, message: `Message must be between 1 and ${MAX_SHOUT_LENGTH} characters` });
  }

  const id = randomUUID();
  await db.insert(schema.shoutMessages).values({ id, channelId: channel.id, userId: viewer.id, body });
  await bumpChannelVersion(channel.id);
  return { id };
});
