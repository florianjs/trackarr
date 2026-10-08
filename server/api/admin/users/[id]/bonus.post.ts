import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '~~/server/db';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { changeBonusPoints, rethrowBonusError } from '~~/server/utils/bonus';
import { uuidSchema, validateBody, validateParam } from '~~/server/utils/schemas';

const grantSchema = z.object({
  amount: z.number().int().min(-10_000_000).max(10_000_000).refine((n) => n !== 0),
  reason: z.string().trim().min(1).max(200),
});

/**
 * POST /api/admin/users/:id/bonus
 * Grant (positive) or remove (negative) points, logged in the ledger
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const userId = validateParam(event, 'id', uuidSchema);
  const { amount, reason } = await validateBody(event, grantSchema);

  try {
    await db.transaction((tx) =>
      changeBonusPoints(tx, {
        userId,
        amount,
        type: 'admin',
        description: `${reason} (by ${session.user.username})`,
      })
    );
  } catch (err) {
    rethrowBonusError(err);
  }

  const [user] = await db
    .select({ points: schema.users.bonusPoints })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return { success: true, points: user?.points ?? 0 };
});
