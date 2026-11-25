import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { requireModeratorSession } from './adminAuth';
import { uuidSchema, validateParam } from './schemas';
import { moderationRights, type ModerationRights } from '~~/shared/utils/userModeration';

/**
 * Staff session plus the member named by the :id route param, refused (403)
 * unless the staff member holds `right` over them
 */
export async function requireModerationTarget(event: H3Event, right: keyof ModerationRights) {
  const session = await requireModeratorSession(event);
  const userId = validateParam(event, 'id', uuidSchema);

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  if (!target) {
    throw createError({ statusCode: 404, message: 'User not found' });
  }

  const actor = {
    id: session.user.id,
    isAdmin: !!session.user.isAdmin,
    isModerator: !!session.user.isModerator,
  };
  const rights = moderationRights(actor, target);
  if (!rights[right]) {
    throw createError({ statusCode: 403, message: 'You cannot do this to this member' });
  }

  return { session, actor, target, rights };
}
