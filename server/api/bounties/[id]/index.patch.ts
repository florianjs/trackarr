import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../../db';
import { requireBonusEnabled } from '../../../utils/bonus';
import { loadBountyFor, stateChanged } from '../../../utils/bounties';
import { validateBody } from '../../../utils/schemas';
import { filterPublicText } from '../../../utils/slurFilter';
import { parseImdbId } from '../../../../shared/utils/mediaIds';

const editSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    imdbId: z.string().max(200).nullable().optional(),
    categoryId: z.uuid().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change' });

/**
 * PATCH /api/bounties/:id
 * Fix the text of a bounty: the requester while it is open, staff any time.
 * The reward is never touched here.
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty, user } = await loadBountyFor(event, 'edit');
  const isStaff = !!(user.isAdmin || user.isModerator);
  const body = await validateBody(event, editSchema);

  let imdbId: string | null | undefined;
  if (body.imdbId !== undefined) {
    imdbId = body.imdbId?.trim() ? parseImdbId(body.imdbId) : null;
    if (body.imdbId?.trim() && !imdbId) {
      throw createError({ statusCode: 400, message: 'Invalid imdbId' });
    }
  }

  const [updated] = await db
    .update(schema.bounties)
    .set({
      ...(body.title !== undefined && { title: await filterPublicText(body.title) }),
      ...(body.description !== undefined && {
        description: body.description?.trim() ? await filterPublicText(body.description.trim()) : null,
      }),
      ...(imdbId !== undefined && { imdbId }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
    })
    // The requester may only edit while open: re-checked at write time in
    // case staff closed it meanwhile
    .where(
      isStaff
        ? eq(schema.bounties.id, bounty.id)
        : and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, 'open'))
    )
    .returning({ id: schema.bounties.id });
  if (!updated) stateChanged();

  return updated;
});
