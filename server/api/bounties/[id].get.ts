import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { requireBonusEnabled } from '../../utils/bonus';
import { validateParam, uuidSchema } from '../../utils/schemas';

/**
 * GET /api/bounties/:id
 */
export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  await requireBonusEnabled();
  const id = validateParam(event, 'id', uuidSchema);

  const bounty = await db.query.bounties.findFirst({
    where: eq(schema.bounties.id, id),
    with: {
      requester: { columns: { id: true, username: true } },
      filledBy: { columns: { id: true, username: true } },
      filledTorrent: { columns: { id: true, infoHash: true, name: true } },
      category: { columns: { id: true, name: true } },
      contributions: {
        columns: { id: true, amount: true, createdAt: true },
        with: { user: { columns: { id: true, username: true } } },
        orderBy: [desc(schema.bountyContributions.createdAt)],
      },
    },
  });

  if (!bounty) {
    throw createError({ statusCode: 404, message: 'Bounty not found' });
  }

  return bounty;
});
