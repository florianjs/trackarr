import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '../../../utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import { z } from 'zod';
import { validateBody } from '../../../utils/schemas';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50),
  newznabId: z.coerce.number().int().min(1000).max(9999).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  // Rate limit admin endpoints
  await rateLimit(event, RATE_LIMITS.admin);

  // Require admin authentication
  await requireAdminSession(event);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Category ID is required',
    });
  }

  // Validate request body
  const body = await validateBody(event, updateCategorySchema);
  const name = body.name.trim();

  // Check if category exists
  const existingCategory = await db.query.categories.findFirst({
    where: eq(schema.categories.id, id),
  });

  if (!existingCategory) {
    throw createError({
      statusCode: 404,
      message: 'Category not found',
    });
  }

  // Generate new slug
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // If this is a subcategory, prefix with parent slug
  if (existingCategory.parentId) {
    const parent = await db.query.categories.findFirst({
      where: eq(schema.categories.id, existingCategory.parentId),
    });

    if (parent) {
      slug = `${parent.slug}-${slug}`;
    }
  }

  try {
    const updateData: {
      name: string;
      slug: string;
      newznabId?: number | null;
    } = {
      name,
      slug,
    };

    // Only update newznabId if explicitly provided
    if (body.newznabId !== undefined) {
      updateData.newznabId = body.newznabId;
    }

    const [category] = await db
      .update(schema.categories)
      .set(updateData)
      .where(eq(schema.categories.id, id))
      .returning();

    return category;
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique violation
      throw createError({
        statusCode: 409,
        message: 'Category with this name already exists',
      });
    }
    throw error;
  }
});
