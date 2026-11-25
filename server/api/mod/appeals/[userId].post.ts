import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { uuidSchema, validateBody, validateParam } from '~~/server/utils/schemas';

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});

/**
 * POST /api/mod/appeals/:userId
 * approve: lift the hold and exempt the account from the IP check for good;
 * reject: the account stays held (it may appeal again)
 */
export default defineEventHandler(async (event) => {
  const { user: staff } = await requireModeratorSession(event);
  const userId = validateParam(event, 'userId', uuidSchema);
  const body = await validateBody(event, decisionSchema);

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true, ipHold: true },
  });
  if (!target) throw createError({ statusCode: 404, message: 'User not found' });
  if (!target.ipHold) throw createError({ statusCode: 400, message: 'This account is not on hold' });

  const approved = body.decision === 'approve';
  await db.transaction(async (tx) => {
    await tx
      .update(schema.ipAppeals)
      .set({
        status: approved ? 'approved' : 'rejected',
        staffNote: body.note || null,
        reviewedBy: staff.id,
        reviewedAt: new Date(),
      })
      .where(and(eq(schema.ipAppeals.userId, userId), eq(schema.ipAppeals.status, 'pending')));
    if (approved) {
      await tx
        .update(schema.users)
        .set({ ipHold: false, ipExempt: true })
        .where(eq(schema.users.id, userId));
    }
  });

  return { userId, decision: body.decision };
});
