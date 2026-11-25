import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../../db';
import { loadBountyFor, refundContributions, stateChanged } from '../../../utils/bounties';

/**
 * DELETE /api/bounties/:id
 * Staff remove a bounty (spam, duplicate). Points still held by an open or
 * claimed bounty go back to the contributors; a filled one was already paid.
 */
export default defineEventHandler(async (event) => {
  const { bounty } = await loadBountyFor(event, 'delete');

  await db.transaction(async (tx) => {
    // Lock the row in the state we checked: a fill accepted meanwhile pays
    // out first. Refund before deleting: contributions go with the row.
    const [locked] = await tx
      .select({ id: schema.bounties.id })
      .from(schema.bounties)
      .where(and(eq(schema.bounties.id, bounty.id), eq(schema.bounties.status, bounty.status)))
      .for('update');
    if (!locked) stateChanged();

    if (bounty.status === 'open' || bounty.status === 'claimed') {
      await refundContributions(tx, bounty);
    }
    await tx.delete(schema.bounties).where(eq(schema.bounties.id, bounty.id));
  });

  return { success: true };
});
