import { randomUUID } from 'crypto';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';
import { validateBody } from '../../../../utils/schemas';
import { checkItemValue, shopItemSchema } from '../../../../utils/shopSchemas';

/**
 * POST /api/admin/shop/items
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await validateBody(event, shopItemSchema);
  checkItemValue(body);

  const [item] = await db
    .insert(schema.shopItems)
    .values({ id: randomUUID(), ...body, description: body.description ?? null })
    .returning();
  return item;
});
