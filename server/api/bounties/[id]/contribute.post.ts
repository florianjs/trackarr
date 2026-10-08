import { randomUUID } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../../db';
import { changeBonusPoints, requireBonusEnabled, rethrowBonusError } from '../../../utils/bonus';
import { loadBountyFor, stateChanged } from '../../../utils/bounties';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import { validateBody } from '../../../utils/schemas';

const contributeSchema = z.object({ points: z.number().int().min(1).max(1_000_000) });

/**
 * POST /api/bounties/:id/contribute
 * Add points to an open bounty's reward
 */
export default defineEventHandler(async (event) => {
  await requireBonusEnabled();
  const { bounty, user } = await loadBountyFor(event, 'contribute');
  await rateLimit(event, RATE_LIMITS.mutation);
  const { points } = await validateBody(event, contributeSchema);

  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(schema.bounties)
        .set({ totalPoints: sql`${schema.bounties.totalPoints} + ${points}` })
        .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, 'open')))
        .returning({ id: schema.bounties.id });
      if (updated.length === 0) stateChanged();

      await changeBonusPoints(tx, {
        userId: user.id,
        amount: -points,
        type: 'bounty_contribute',
        description: bounty.title,
        refId: bounty.id,
      });
      await tx.insert(schema.bountyContributions).values({
        id: randomUUID(),
        bountyId: bounty.id,
        userId: user.id,
        amount: points,
      });
    });
  } catch (err) {
    rethrowBonusError(err);
  }

  return { success: true };
});
