import { z } from 'zod';
import { SHOP_ITEM_TYPES } from './bonus';

export const shopItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  type: z.enum(SHOP_ITEM_TYPES),
  price: z.number().int().min(1).max(10_000_000),
  // upload_credit: bytes; invite: count; gif_avatar: ignored
  value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export function checkItemValue(item: { type: string; value: number }) {
  if ((item.type === 'upload_credit' || item.type === 'invite') && item.value <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Upload credit and invite items need a positive value',
    });
  }
}
