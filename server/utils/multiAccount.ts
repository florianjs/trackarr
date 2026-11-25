import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { shouldHoldForSharedIp, type IpSubject } from '../../shared/utils/multiAccount';
import { isMultiAccountGuardEnabled } from './settings';

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Advisory lock namespace (two-key form, apart from the single-key locks)
const SHARED_IP_LOCK = 7_202_611;

/**
 * Serialize sign-ups and sign-ins from one IP until the transaction ends:
 * two accounts signing in at once must not both see the IP as free
 */
export async function lockSharedIp(tx: Executor, ip: string | null): Promise<void> {
  if (!ip) return;
  await tx.execute(sql`select pg_advisory_xact_lock(${SHARED_IP_LOCK}, hashtext(${ip}))`);
}

/**
 * Should this account be held for sharing `ip` with another account in good
 * standing? `userId` is null for a sign-up (the row does not exist yet)
 */
export async function detectSharedIp(
  ip: string | null,
  userId: string | null,
  self: IpSubject,
  executor: Executor = db
): Promise<boolean> {
  if (!ip || !(await isMultiAccountGuardEnabled())) return false;
  if (!shouldHoldForSharedIp(self, [{ isBanned: false, ipHold: false, ipExempt: false }])) return false;

  const [peer] = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.lastIp, ip),
        eq(users.isBanned, false),
        eq(users.ipHold, false),
        eq(users.ipExempt, false),
        userId ? ne(users.id, userId) : undefined
      )
    )
    .limit(1);

  return Boolean(peer);
}
