import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';

const { users, ipAppeals } = schema;

/**
 * GET /api/mod/appeals
 * Accounts held by the multi-account guard, with their latest appeal and
 * the other accounts seen on the same IP (the IP itself is not sent)
 */
export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const held = await db
    .select({
      id: users.id,
      username: users.username,
      lastIp: users.lastIp,
      createdAt: users.createdAt,
      lastSeen: users.lastSeen,
    })
    .from(users)
    .where(and(eq(users.ipHold, true), eq(users.isBanned, false)))
    .orderBy(desc(users.lastSeen))
    .limit(200);

  if (held.length === 0) return { accounts: [] };

  const ids = held.map((u) => u.id);
  const ips = [...new Set(held.map((u) => u.lastIp).filter((ip): ip is string => !!ip))];

  const [appeals, neighbours] = await Promise.all([
    db
      .select({
        userId: ipAppeals.userId,
        message: ipAppeals.message,
        status: ipAppeals.status,
        staffNote: ipAppeals.staffNote,
        createdAt: ipAppeals.createdAt,
      })
      .from(ipAppeals)
      .where(inArray(ipAppeals.userId, ids))
      .orderBy(desc(ipAppeals.createdAt)),
    ips.length
      ? db
          .select({ id: users.id, username: users.username, lastIp: users.lastIp, isBanned: users.isBanned })
          .from(users)
          .where(and(inArray(users.lastIp, ips), ne(users.ipHold, true)))
          .limit(1000)
      : Promise.resolve([]),
  ]);

  const latestAppeal = new Map<string, (typeof appeals)[number]>();
  for (const a of appeals) if (!latestAppeal.has(a.userId)) latestAppeal.set(a.userId, a);

  return {
    accounts: held.map(({ lastIp, ...u }) => ({
      ...u,
      appeal: latestAppeal.get(u.id) ?? null,
      sharedWith: neighbours
        .filter((n) => lastIp && n.lastIp === lastIp && n.id !== u.id)
        .map((n) => ({ id: n.id, username: n.username, isBanned: n.isBanned })),
    })),
  };
});
