import { asc } from 'drizzle-orm';
import { db, schema } from '../../../../db';
import { requireAdminSession } from '../../../../utils/adminAuth';

/**
 * GET /api/admin/shop/items
 * All items, including inactive ones
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return db
    .select()
    .from(schema.shopItems)
    .orderBy(asc(schema.shopItems.sortOrder), asc(schema.shopItems.price));
});
