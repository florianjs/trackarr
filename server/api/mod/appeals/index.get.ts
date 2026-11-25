import { and, asc, desc, eq, gt, inArray, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '~~/server/db';
import { requireModeratorSession } from '~~/server/utils/adminAuth';
import { validateQuery } from '~~/server/utils/schemas';

const { users, ipAppeals } = schema;

const PAGE_SIZE = 50;

// Keyset cursor: "<createdAt ISO>|<id>" of the last account of the page
const querySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[0-9a-f-]{36}$/)
    .optional(),
});

/**
 * GET /api/mod/appeals
 * Accounts held by the multi-account guard, with their latest appeal and
 * the other accounts seen on the same IP (the IP itself is not sent).
 * Oldest held account first, by pages (`cursor` from `nextCursor`)
 */
export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const { cursor } = validateQuery(event, querySchema);
  const [afterDate, afterId] = cursor ? cursor.split('|') : [];
  const after =
    afterDate && afterId
      ? or(
          gt(users.createdAt, new Date(afterDate)),
          and(eq(users.createdAt, new Date(afterDate)), gt(users.id, afterId))
        )
      : undefined;

  const held = await db
    .select({
      id: users.id,
      username: users.username,
      lastIp: users.lastIp,
      createdAt: users.createdAt,
      lastSeen: users.lastSeen,
    })
    .from(users)
    .where(and(eq(users.ipHold, true), eq(users.isBanned, false), after))
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = held.length > PAGE_SIZE;
  if (hasMore) held.pop();
  const last = held.at(-1);
  const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null;

  if (held.length === 0) return { accounts: [], nextCursor: null };

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
    nextCursor,
    accounts: held.map(({ lastIp, ...u }) => ({
      ...u,
      appeal: latestAppeal.get(u.id) ?? null,
      sharedWith: neighbours
        .filter((n) => lastIp && n.lastIp === lastIp && n.id !== u.id)
        .map((n) => ({ id: n.id, username: n.username, isBanned: n.isBanned })),
    })),
  };
});
