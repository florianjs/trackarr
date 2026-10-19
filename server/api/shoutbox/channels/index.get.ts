import { asc } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { ensureDefaultChannels, getMutedUntil, requireShoutViewer } from '../../../utils/shoutbox';
import { canReactChannel, canReadChannel, canWriteChannel } from '../../../utils/shoutboxRules';

/**
 * GET /api/shoutbox/channels
 * Channels the member can read, with what they may do there
 */
export default defineEventHandler(async (event) => {
  const viewer = await requireShoutViewer(event);
  await ensureDefaultChannels();

  const [channels, mutedUntil] = await Promise.all([
    db
      .select()
      .from(schema.shoutChannels)
      .orderBy(asc(schema.shoutChannels.position), asc(schema.shoutChannels.createdAt)),
    getMutedUntil(viewer.id),
  ]);

  return {
    mutedUntil,
    channels: channels
      .filter((c) => canReadChannel(c, viewer))
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        canWrite: canWriteChannel(c, viewer),
        canReact: canReactChannel(c, viewer),
      })),
  };
});
