import { db, schema } from '../../../db';
import { requireAdminSession } from '../../../utils/adminAuth';
import { z } from 'zod';
import { generateToken } from '../../../utils/crypto';

const generateInviteSchema = z.object({
  count: z.number().int().min(1).max(50).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * POST /api/admin/invites/generate
 * Generate unique invitation codes (admin only)
 * These codes are not tied to admin's personal invite count
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminSession(event);

  const body = await readBody(event);
  const { count, expiresInDays } = generateInviteSchema.parse(body || {});

  const codes: string[] = [];
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  for (let i = 0; i < count; i++) {
    const code = generateToken(16).toUpperCase(); // 32-char code
    const id = crypto.randomUUID();

    await db.insert(schema.invitations).values({
      id,
      code,
      createdBy: admin.user.id,
      expiresAt,
    });

    codes.push(code);
  }

  return {
    success: true,
    codes,
    expiresAt,
  };
});
