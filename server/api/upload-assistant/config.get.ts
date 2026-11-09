import { asc } from 'drizzle-orm';
import { db, schema } from '../../db';
import { requireUploader } from '../../utils/uploaderAuth';
import { getSiteName } from '../../utils/settings';

/**
 * GET /api/upload-assistant/config
 * What the web assistant and the CLI need to build and publish a torrent:
 * the personal announce URL, the source tag, categories and tags.
 * Session or `Authorization: Bearer <API key>`.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUploader(event);

  const announce = new URL(useRuntimeConfig().public.trackerHttpUrl as string);
  announce.searchParams.set('passkey', user.passkey);

  const [categories, tags, siteName] = await Promise.all([
    db
      .select({ id: schema.categories.id, name: schema.categories.name, parentId: schema.categories.parentId })
      .from(schema.categories)
      .orderBy(asc(schema.categories.name)),
    db.select({ id: schema.tags.id, name: schema.tags.name }).from(schema.tags).orderBy(asc(schema.tags.name)),
    getSiteName(),
  ]);

  return {
    siteName,
    announceUrl: announce.toString(),
    // info.source: the same files shared elsewhere get another info hash here
    source: getRequestURL(event).hostname,
    categories,
    tags,
    screenshots: { host: 'pixhost', maxPerUpload: 12 },
  };
});
