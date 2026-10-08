import { eq } from 'drizzle-orm';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { uuidSchema, validateParam } from '../../../../utils/schemas';

/**
 * DELETE /api/admin/shop/items/:id
 * Past purchases stay in the ledger (by name), so deleting is safe
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = validateParam(event, 'id', uuidSchema);

  const deleted = await db
    .delete(schema.shopItems)
    .where(eq(schema.shopItems.id, id))
    .returning({ id: schema.shopItems.id });
  if (deleted.length === 0) throw createError({ statusCode: 404, message: 'Item not found' });
  return { success: true };
});
