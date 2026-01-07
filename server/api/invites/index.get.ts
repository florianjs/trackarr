import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const invites = await db.query.invitations.findMany({
    where: eq(schema.invitations.createdBy, user.id),
    with: {
      usedByUser: {
        columns: { id: true, username: true },
      },
    },
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });

  // Get user's remaining invites
  const userData = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { invitesRemaining: true },
  });

  return {
    invites,
    remaining: userData?.invitesRemaining || 0,
  };
});
