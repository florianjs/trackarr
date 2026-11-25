import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { shouldHoldForSharedIp, type IpSubject } from '../../shared/utils/multiAccount';
import { isMultiAccountGuardEnabled } from './settings';

/**
 * Should this account be held for sharing `ip` with another account?
 * `userId` is null for a sign-up (the row does not exist yet)
 */
export async function detectSharedIp(
  ip: string | null,
  userId: string | null,
  self: IpSubject
): Promise<boolean> {
  if (!ip || !(await isMultiAccountGuardEnabled())) return false;
  if (!shouldHoldForSharedIp(self, [{ isBanned: false, ipHold: false, ipExempt: false }])) return false;

  const others = await db
    .select({ isBanned: users.isBanned, ipHold: users.ipHold, ipExempt: users.ipExempt })
    .from(users)
    .where(userId ? and(eq(users.lastIp, ip), ne(users.id, userId)) : eq(users.lastIp, ip))
    .limit(50);

  return shouldHoldForSharedIp(self, others);
}
