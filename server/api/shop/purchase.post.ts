import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import {
  changeBonusPoints,
  requireBonusEnabled,
  resolvePurchase,
  rethrowBonusError,
} from '../../utils/bonus';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';
import { validateBody } from '../../utils/schemas';

const purchaseSchema = z.object({ itemId: z.uuid() });

/**
 * POST /api/shop/purchase
 * Spend points on a shop item; debit and effect happen in one transaction
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  await requireBonusEnabled();
  await rateLimit(event, RATE_LIMITS.mutation);
  const { itemId } = await validateBody(event, purchaseSchema);

  const item = await db.query.shopItems.findFirst({
    where: eq(schema.shopItems.id, itemId),
  });
  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' });
  }

  try {
    await db.transaction(async (tx) => {
      // Lock the buyer row so the ownership check and debit are consistent
      const [buyer] = await tx
        .select({ canUseGifAvatar: schema.users.canUseGifAvatar })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .for('update');

      const resolved = resolvePurchase(item, {
        canUseGifAvatar: buyer?.canUseGifAvatar ?? false,
      });
      if (!resolved.ok) {
        throw createError({ statusCode: 400, message: resolved.reason });
      }

      await changeBonusPoints(tx, {
        userId: user.id,
        amount: -item.price,
        type: 'purchase',
        description: item.name,
        refId: item.id,
      });

      const effect = resolved.effect;
      if (effect.kind === 'upload_credit') {
        await tx
          .update(schema.users)
          .set({ uploaded: sql`${schema.users.uploaded} + ${effect.bytes}` })
          .where(eq(schema.users.id, user.id));
      } else if (effect.kind === 'invite') {
        await tx
          .update(schema.users)
          .set({
            invitesRemaining: sql`${schema.users.invitesRemaining} + ${effect.count}`,
          })
          .where(eq(schema.users.id, user.id));
      } else {
        await tx
          .update(schema.users)
          .set({ canUseGifAvatar: true })
          .where(eq(schema.users.id, user.id));
      }
    });
  } catch (err) {
    rethrowBonusError(err);
  }

  const [account] = await db
    .select({ points: schema.users.bonusPoints })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));

  return { success: true, points: account?.points ?? 0 };
});
