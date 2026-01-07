import { db } from '~~/server/db';
import { roles } from '~~/server/db/schema';
import { requireAdminSession } from '~~/server/utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Role ID is required',
    });
  }

  const updateData: Record<string, any> = {};

  if (body.name !== undefined) {
    updateData.name = body.name.trim();
  }
  if (body.color !== undefined) {
    updateData.color = body.color;
  }
  if (body.canUploadWithoutModeration !== undefined) {
    updateData.canUploadWithoutModeration = !!body.canUploadWithoutModeration;
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    });
  }

  const [updatedRole] = await db
    .update(roles)
    .set(updateData)
    .where(eq(roles.id, id))
    .returning();

  if (!updatedRole) {
    throw createError({
      statusCode: 404,
      message: 'Role not found',
    });
  }

  return updatedRole;
});
