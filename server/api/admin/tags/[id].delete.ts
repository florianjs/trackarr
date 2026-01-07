import { db, schema } from '../../../db';
import { requireAdminSession } from '../../../utils/adminAuth';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: 'Tag ID required' });
  }

  await db.delete(schema.tags).where(eq(schema.tags.id, id));

  return { success: true };
});
