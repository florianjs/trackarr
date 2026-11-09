import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db';
import { registrationPayments, users } from '../../../db/schema';
import { requireAdminSession } from '../../../utils/adminAuth';
import { invoiceView } from '../../../utils/payments/invoices';

/**
 * GET /api/admin/payments
 * Locked accounts with their invoices, and the latest paid invoices
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const pending = await db
    .select({ id: users.id, username: users.username, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.paymentPending, true))
    .orderBy(desc(users.createdAt))
    .limit(200);

  const invoices = pending.length
    ? await db
        .select()
        .from(registrationPayments)
        .where(inArray(registrationPayments.userId, pending.map((u) => u.id)))
    : [];

  const paid = await db
    .select({ invoice: registrationPayments, username: users.username })
    .from(registrationPayments)
    .innerJoin(users, eq(users.id, registrationPayments.userId))
    .where(eq(registrationPayments.status, 'paid'))
    .orderBy(desc(registrationPayments.paidAt))
    .limit(50);

  return {
    pending: pending.map((user) => ({
      ...user,
      invoices: invoices.filter((i) => i.userId === user.id).map(invoiceView),
    })),
    paid: paid.map((row) => ({
      username: row.username,
      approvedBy: row.invoice.approvedBy,
      ...invoiceView(row.invoice),
    })),
  };
});
