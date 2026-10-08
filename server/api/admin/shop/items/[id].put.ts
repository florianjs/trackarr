import { eq } from 'drizzle-orm';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { uuidSchema, validateBody, validateParam } from '../../../../utils/schemas';
import { checkItemValue, shopItemSchema } from '../../../../utils/shopSchemas';

/**
 * PUT /api/admin/shop/items/:id
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = validateParam(event, 'id', uuidSchema);
  const body = await validateBody(event, shopItemSchema);
  checkItemValue(body);

  const [item] = await db
    .update(schema.shopItems)
    .set({ ...body, description: body.description ?? null })
    .where(eq(schema.shopItems.id, id))
    .returning();
  if (!item) throw createError({ statusCode: 404, message: 'Item not found' });
  return item;
});
