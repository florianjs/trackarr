import { asc, eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { requireBonusEnabled } from '../../utils/bonus';

/**
 * GET /api/shop/items
 * Items currently on sale
 */
export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  await requireBonusEnabled();

  return db
    .select({
      id: schema.shopItems.id,
      name: schema.shopItems.name,
      description: schema.shopItems.description,
      type: schema.shopItems.type,
      price: schema.shopItems.price,
      value: schema.shopItems.value,
    })
    .from(schema.shopItems)
    .where(eq(schema.shopItems.isActive, true))
    .orderBy(asc(schema.shopItems.sortOrder), asc(schema.shopItems.price));
});
