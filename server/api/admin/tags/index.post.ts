import { db, schema } from '../../../db';
import { requireAdminSession } from '../../../utils/adminAuth';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .default('#6b7280'),
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const body = await readBody(event);
  const data = createTagSchema.parse(body);

  const tag = await db
    .insert(schema.tags)
    .values({
      id: randomUUID(),
      name: data.name,
      slug: data.slug.toLowerCase(),
      color: data.color,
    })
    .returning();

  return tag[0];
});
