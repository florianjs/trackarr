import { db } from '../../../db';
import { panicState } from '../../../db/schema';
import { requireAdminSession } from '../../../utils/adminAuth';

/**
 * GET /api/admin/panic
 * Get current panic/encryption state
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const state = await db.query.panicState.findFirst();

  return {
    isEncrypted: state?.isEncrypted ?? false,
    encryptedAt: state?.encryptedAt ?? null,
  };
});
