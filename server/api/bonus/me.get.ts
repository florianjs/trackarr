import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { redis } from '../../redis/client';
import { getBonusSettings } from '../../utils/settings';

/**
 * GET /api/bonus/me
 * Current user's balance, earning rules and recent ledger entries
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);
  const settings = await getBonusSettings();

  const [account, transactions, seedingNow] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
      columns: { bonusPoints: true, avatarUrl: true, canUseGifAvatar: true },
    }),
    db
      .select({
        id: schema.bonusTransactions.id,
        amount: schema.bonusTransactions.amount,
        type: schema.bonusTransactions.type,
        description: schema.bonusTransactions.description,
        createdAt: schema.bonusTransactions.createdAt,
      })
      .from(schema.bonusTransactions)
      .where(eq(schema.bonusTransactions.userId, user.id))
      .orderBy(desc(schema.bonusTransactions.createdAt))
      .limit(25),
    redis.zcard(`bonus:seeding:${user.id}`).catch(() => 0),
  ]);

  return {
    enabled: settings.enabled,
    points: account?.bonusPoints ?? 0,
    avatarUrl: account?.avatarUrl ?? null,
    canUseGifAvatar: account?.canUseGifAvatar ?? false,
    seedingNow,
    rules: {
      pointsPerSeedDay: settings.pointsPerSeedDay,
      maxSeedingTorrents: settings.maxSeedingTorrents,
      pointsPerUpload: settings.pointsPerUpload,
      bountyMinPoints: settings.bountyMinPoints,
    },
    transactions,
  };
});
