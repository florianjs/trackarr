import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { getStatsMany, type TorrentStats } from '../redis/cache';
import { getUserActivity } from '../redis/userActivity';
import { getUserHnrCount } from '../utils/hnr';
import { sanitizeRichText } from '../utils/sanitize';
import { getBonusSettings, getWelcomeMessage } from '../utils/settings';

/**
 * GET /api/dashboard
 * Everything the member home page shows, in one request
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);

  const [account, activity, hnr, bonus, welcome, latest, bounties, topics] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
        columns: { bonusPoints: true, uploaded: true, downloaded: true, createdAt: true },
      }),
      getUserActivity(user.id).catch(() => ({ seeding: 0, leeching: 0 })),
      getUserHnrCount(user.id),
      getBonusSettings(),
      getWelcomeMessage(),
      db.query.torrents.findMany({
        where: and(eq(schema.torrents.isActive, true), eq(schema.torrents.isApproved, true)),
        columns: { infoHash: true, name: true, size: true, createdAt: true },
        with: { category: { columns: { name: true } } },
        orderBy: [desc(schema.torrents.createdAt)],
        limit: 8,
      }),
      db.query.bounties.findMany({
        where: eq(schema.bounties.status, 'open'),
        columns: { id: true, title: true, totalPoints: true },
        orderBy: [desc(schema.bounties.totalPoints)],
        limit: 5,
      }),
      db.query.forumTopics.findMany({
        columns: { id: true, title: true, updatedAt: true },
        with: {
          author: { columns: { username: true } },
          category: { columns: { name: true } },
        },
        orderBy: [desc(schema.forumTopics.updatedAt)],
        limit: 5,
      }),
    ]);

  // Without Redis the page still renders, with empty swarm counts
  const stats = await getStatsMany(latest.map((t) => t.infoHash)).catch(
    () => new Map<string, TorrentStats>()
  );

  return {
    account: {
      uploaded: account?.uploaded ?? 0,
      downloaded: account?.downloaded ?? 0,
      memberSince: account?.createdAt ?? null,
      points: bonus.enabled ? (account?.bonusPoints ?? 0) : null,
      seeding: activity.seeding,
      leeching: activity.leeching,
      hnr,
    },
    // Admin-written note (Admin > Branding), rendered as rich text
    welcomeMessage: welcome.trim() ? sanitizeRichText(welcome) : null,
    latest: latest.map((t) => ({
      ...t,
      category: t.category?.name ?? null,
      seeders: stats.get(t.infoHash)?.seeders ?? 0,
      leechers: stats.get(t.infoHash)?.leechers ?? 0,
    })),
    bounties: bonus.enabled ? bounties : [],
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      updatedAt: t.updatedAt,
      author: t.author?.username ?? null,
      category: t.category?.name ?? null,
    })),
  };
});
