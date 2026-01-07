import { db, schema } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const params = paramsSchema.parse(getRouterParams(event));

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, params.id),
    columns: {
      id: true,
      username: true,
      isAdmin: true,
      isModerator: true,
      uploaded: true,
      downloaded: true,
      createdAt: true,
      lastSeen: true,
    },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    });
  }

  // Calculate ratio
  const ratio =
    user.downloaded === 0
      ? user.uploaded > 0
        ? Infinity
        : 1
      : user.uploaded / user.downloaded;

  // Count uploads
  const uploadsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.torrents)
    .where(eq(schema.torrents.uploaderId, params.id));

  return {
    ...user,
    ratio: ratio === Infinity ? null : ratio, // null = infinite
    uploadsCount: uploadsCount[0]?.count || 0,
  };
});
