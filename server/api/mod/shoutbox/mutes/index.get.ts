import { asc, eq, gt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';

/**
 * GET /api/mod/shoutbox/mutes
 * Members currently muted in the shoutbox
 */
export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const moderator = alias(schema.users, 'moderator');

  return db
    .select({
      userId: schema.shoutMutes.userId,
      username: schema.users.username,
      until: schema.shoutMutes.until,
      reason: schema.shoutMutes.reason,
      mutedBy: moderator.username,
      createdAt: schema.shoutMutes.createdAt,
    })
    .from(schema.shoutMutes)
    .innerJoin(schema.users, eq(schema.users.id, schema.shoutMutes.userId))
    .leftJoin(moderator, eq(moderator.id, schema.shoutMutes.mutedBy))
    .where(gt(schema.shoutMutes.until, new Date()))
    .orderBy(asc(schema.shoutMutes.until));
});
