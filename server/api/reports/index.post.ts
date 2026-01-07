import { db, schema } from '../../db';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';

const reportSchema = z.object({
  targetType: z.enum(['torrent', 'user', 'post', 'comment']),
  targetId: z.string().min(1),
  reason: z.string().min(10).max(500),
  details: z.string().max(2000).optional(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  rateLimit(event, RATE_LIMITS.mutation);

  const body = await readBody(event);
  const data = reportSchema.parse(body);

  // Verify target exists
  let targetExists = false;
  switch (data.targetType) {
    case 'torrent':
      const torrent = await db.query.torrents.findFirst({
        where: (t, { eq }) => eq(t.id, data.targetId),
      });
      targetExists = !!torrent;
      break;
    case 'user':
      const targetUser = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, data.targetId),
      });
      targetExists = !!targetUser;
      break;
    case 'post':
      const post = await db.query.forumPosts.findFirst({
        where: (p, { eq }) => eq(p.id, data.targetId),
      });
      targetExists = !!post;
      break;
    case 'comment':
      const comment = await db.query.torrentComments.findFirst({
        where: (c, { eq }) => eq(c.id, data.targetId),
      });
      targetExists = !!comment;
      break;
  }

  if (!targetExists) {
    throw createError({
      statusCode: 404,
      message: 'Target not found',
    });
  }

  // Create report
  const report = await db
    .insert(schema.reports)
    .values({
      id: randomUUID(),
      reporterId: user.id,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      details: data.details || null,
      status: 'pending',
    })
    .returning();

  return {
    success: true,
    message: 'Report submitted successfully',
    data: report[0],
  };
});
