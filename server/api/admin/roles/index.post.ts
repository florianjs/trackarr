import { db } from '~~/server/db';
import { roles } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { randomUUID } from 'crypto';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const body = await readBody(event);

  if (!body.name?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Role name is required',
    });
  }

  const id = randomUUID();

  const [newRole] = await db
    .insert(roles)
    .values({
      id,
      name: body.name.trim(),
      color: body.color || '#6b7280',
      canUploadWithoutModeration: !!body.canUploadWithoutModeration,
    })
    .returning();

  return newRole;
});
