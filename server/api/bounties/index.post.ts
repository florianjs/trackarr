import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { changeBonusPoints, requireBonusEnabled, rethrowBonusError } from '../../utils/bonus';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';
import { validateBody } from '../../utils/schemas';
import { getBonusSettings } from '../../utils/settings';
import { parseImdbId } from '../../../shared/utils/mediaIds';

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(5000).optional(),
  imdbId: z.string().max(200).optional(),
  categoryId: z.uuid().nullable().optional(),
  points: z.number().int().positive(),
});

/**
 * POST /api/bounties
 * Open a request; the initial reward is taken from the requester's balance
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  await requireBonusEnabled();
  await rateLimit(event, RATE_LIMITS.mutation);
  const body = await validateBody(event, createSchema);

  const { bountyMinPoints } = await getBonusSettings();
  if (body.points < bountyMinPoints) {
    throw createError({
      statusCode: 400,
      message: `A bounty needs at least ${bountyMinPoints} points`,
    });
  }

  const imdbId = body.imdbId?.trim() ? parseImdbId(body.imdbId) : null;
  if (body.imdbId?.trim() && !imdbId) {
    throw createError({ statusCode: 400, message: 'Invalid imdbId' });
  }

  if (body.categoryId) {
    const category = await db.query.categories.findFirst({
      where: eq(schema.categories.id, body.categoryId),
      columns: { id: true },
    });
    if (!category) throw createError({ statusCode: 400, message: 'Invalid category' });
  }

  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await changeBonusPoints(tx, {
        userId: user.id,
        amount: -body.points,
        type: 'bounty_create',
        description: body.title,
        refId: id,
      });
      await tx.insert(schema.bounties).values({
        id,
        title: body.title,
        description: body.description?.trim() || null,
        imdbId,
        categoryId: body.categoryId ?? null,
        requesterId: user.id,
        totalPoints: body.points,
      });
      await tx.insert(schema.bountyContributions).values({
        id: randomUUID(),
        bountyId: id,
        userId: user.id,
        amount: body.points,
      });
    });
  } catch (err) {
    rethrowBonusError(err);
  }

  return { success: true, id };
});
