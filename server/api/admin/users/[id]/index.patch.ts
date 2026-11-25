import { and, eq, ne, sql } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { validateBody } from '~~/server/utils/schemas';
import { requireModerationTarget } from '~~/server/utils/userModeration';
import { userEditSchema } from '~~/shared/utils/userModeration';
import { isUniqueViolation } from '~~/server/utils/dbErrors';

/**
 * PATCH /api/admin/users/:id
 * Rename a member or set their invites left (admin only)
 */
export default defineEventHandler(async (event) => {
  const { target } = await requireModerationTarget(event, 'edit');
  const body = await validateBody(event, userEditSchema);

  if (body.username !== undefined && body.username !== target.username) {
    // Case-insensitive: "Bob" next to "bob" reads as impersonation
    const [taken] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(sql`lower(${schema.users.username}) = lower(${body.username})`, ne(schema.users.id, target.id)))
      .limit(1);
    if (taken) {
      throw createError({ statusCode: 409, message: 'Username already taken' });
    }
  }

  try {
    const [updated] = await db
      .update(schema.users)
      .set({
        ...(body.username !== undefined && { username: body.username }),
        ...(body.invitesRemaining !== undefined && { invitesRemaining: body.invitesRemaining }),
      })
      .where(eq(schema.users.id, target.id))
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        invitesRemaining: schema.users.invitesRemaining,
      });
    return updated;
  } catch (err) {
    // Unique index race with a sign-up
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, message: 'Username already taken' });
    }
    throw err;
  }
});
