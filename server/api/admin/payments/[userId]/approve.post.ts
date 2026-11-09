import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../../db';
import { registrationPayments, users } from '../../../../db/schema';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { uuidSchema } from '../../../../utils/schemas';
import { activateAccount } from '../../../../utils/payments/invoices';

/**
 * POST /api/admin/payments/:userId/approve
 * Unlock a locked account by hand (paid another way, late payment, gift)
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const parsed = uuidSchema.safeParse(getRouterParam(event, 'userId'));
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid user id' });

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, parsed.data), eq(users.paymentPending, true)))
    .limit(1);
  if (!user) throw createError({ statusCode: 404, message: 'No locked account with this id' });

  // Recorded on its latest open invoice, if it has one
  const [invoice] = await db
    .select({ id: registrationPayments.id })
    .from(registrationPayments)
    .where(
      and(
        eq(registrationPayments.userId, user.id),
        inArray(registrationPayments.status, ['pending', 'confirming'])
      )
    )
    .orderBy(desc(registrationPayments.createdAt))
    .limit(1);

  await activateAccount(user.id, invoice?.id ?? null, session.user.id);
  return { success: true };
});
