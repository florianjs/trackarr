import { db, schema } from '../../../db';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '../../../utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';
import { validateBody, adminCategorySchema } from '../../../utils/schemas';

export default defineEventHandler(async (event) => {
  // Rate limit admin endpoints
  rateLimit(event, RATE_LIMITS.admin);

  // Require admin authentication
  await requireAdminSession(event);

  // Validate request body with Zod
  const body = await validateBody(event, adminCategorySchema);

  const name = body.name.trim();
  const parentId = body.parentId || null;

  // Generate slug, prefixing with parent slug if subcategory
  let slug =
    body.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  // If this is a subcategory, validate parent exists
  if (parentId) {
    const parent = await db.query.categories.findFirst({
      where: eq(schema.categories.id, parentId),
    });

    if (!parent) {
      throw createError({
        statusCode: 404,
        message: 'Parent category not found',
      });
    }

    // Prefix slug with parent slug for unique identification
    slug = `${parent.slug}-${slug}`;
  }

  try {
    const id = randomUUID();
    const [category] = await db
      .insert(schema.categories)
      .values({
        id,
        name,
        slug,
        parentId,
        createdAt: new Date(),
      })
      .returning();

    return category;
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique violation
      throw createError({
        statusCode: 409,
        message: 'Category already exists',
      });
    }
    throw error;
  }
});
