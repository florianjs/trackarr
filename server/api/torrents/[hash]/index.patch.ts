/**
 * PATCH /api/torrents/:hash
 * Update torrent description and/or category
 * Owner, moderator, or admin can edit
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { torrents, categories } from '../../../db/schema';
import { requireAuthSession } from '../../../utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import { z } from 'zod';
import { parseMediaIds } from '../../../../shared/utils/mediaIds';

const mediaIdSchema = z.union([z.string().max(200), z.number()]).nullable().optional();

const patchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  imdbId: mediaIdSchema,
  tmdbId: mediaIdSchema,
  tvdbId: mediaIdSchema,
  description: z.string().max(10000).nullable().optional(),
  categoryId: z.union([z.uuid(), z.literal('')]).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  // Rate limit mutations
  await rateLimit(event, RATE_LIMITS.mutation);

  // Require authentication
  const { user } = await requireAuthSession(event);

  const hash = getRouterParam(event, 'hash');

  if (!hash) {
    throw createError({
      statusCode: 400,
      message: 'Missing info hash',
    });
  }

  const infoHash = hash.toLowerCase();

  // Get the torrent
  const existing = await db.query.torrents.findFirst({
    where: eq(torrents.infoHash, infoHash),
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Torrent not found',
    });
  }

  // Check permissions: owner, moderator, or admin
  const isOwner = existing.uploaderId === user.id;
  const canEdit = isOwner || user.isAdmin || user.isModerator;

  if (!canEdit) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to edit this torrent',
    });
  }

  // Read body
  const parsedBody = patchSchema.safeParse(await readBody(event));
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, message: 'Invalid request body' });
  }
  const { description, categoryId, name } = parsedBody.data;
  const media = parseMediaIds(parsedBody.data);
  if (media.invalid.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Invalid ${media.invalid.join(', ')}`,
    });
  }

  // Validate categoryId if provided
  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    const categoryExists = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!categoryExists) {
      throw createError({
        statusCode: 400,
        message: 'Invalid category',
      });
    }
  }

  // Build update object
  const updateData: {
    name?: string;
    description?: string | null;
    categoryId?: string | null;
    imdbId?: string | null;
    tmdbId?: number | null;
    tvdbId?: number | null;
  } = { ...media.ids };

  if (name !== undefined) {
    updateData.name = name;
  }

  if (description !== undefined) {
    updateData.description = description || null;
  }

  if (categoryId !== undefined) {
    updateData.categoryId = categoryId || null;
  }

  // Update the torrent
  if (Object.keys(updateData).length > 0) {
    await db
      .update(torrents)
      .set(updateData)
      .where(eq(torrents.infoHash, infoHash));
  }

  // Fetch updated torrent
  const updated = await db.query.torrents.findFirst({
    where: eq(torrents.infoHash, infoHash),
    with: {
      category: true,
    },
  });

  return {
    success: true,
    message: 'Torrent updated',
    data: {
      infoHash: updated!.infoHash,
      name: updated!.name,
      description: updated!.description,
      categoryId: updated!.categoryId,
      category: updated!.category,
      imdbId: updated!.imdbId,
      tmdbId: updated!.tmdbId,
      tvdbId: updated!.tvdbId,
    },
  };
});
