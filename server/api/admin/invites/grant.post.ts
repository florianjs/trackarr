import { db, schema } from '../../../db';
import { requireAdminSession } from '../../../utils/adminAuth';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const grantInvitesSchema = z.object({
  userId: z.string().uuid(),
  count: z.number().int().min(1).max(100),
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const body = await readBody(event);
  const { userId, count } = grantInvitesSchema.parse(body);

  const result = await db
    .update(schema.users)
    .set({
      invitesRemaining: sql`${schema.users.invitesRemaining} + ${count}`,
    })
    .where(eq(schema.users.id, userId))
    .returning({ invitesRemaining: schema.users.invitesRemaining });

  if (result.length === 0) {
    throw createError({ statusCode: 404, message: 'User not found' });
  }

  return {
    success: true,
    invitesRemaining: result[0].invitesRemaining,
  };
});
