import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { canBountyAction, type BountyAction } from './bonus';
import { validateParam, uuidSchema } from './schemas';

/**
 * Load a bounty and check the current user may perform `action` on it.
 * State is re-checked with conditional updates inside each handler's
 * transaction; this gives early, readable errors.
 */
export async function loadBountyFor(event: H3Event, action: BountyAction) {
  const session = await requireAuthSession(event);
  const id = validateParam(event, 'id', uuidSchema);

  const bounty = await db.query.bounties.findFirst({
    where: eq(schema.bounties.id, id),
  });
  if (!bounty) {
    throw createError({ statusCode: 404, message: 'Bounty not found' });
  }

  const actor = {
    userId: session.user.id,
    isStaff: session.user.isAdmin || session.user.isModerator,
  };
  if (!canBountyAction(bounty, action, actor)) {
    throw createError({
      statusCode: 409,
      message: `Cannot ${action} this bounty in its current state`,
    });
  }

  return { bounty, user: session.user };
}

export function stateChanged(): never {
  throw createError({
    statusCode: 409,
    message: 'Bounty changed in the meantime, please reload',
  });
}
