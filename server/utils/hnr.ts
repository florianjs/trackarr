import { db, schema } from '../db';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  isHnrEnabled,
  getHnrRequiredSeedTime,
  getHnrGracePeriod,
} from './settings';

/**
 * Record a completed download (snatch).
 * The entry is also the proof that the user really holds the torrent (used
 * for seeding bonus points), so it is created even when HnR is disabled, as
 * exempt: it will never count as a hit & run.
 */
export async function createHnrEntry(
  userId: string,
  torrentId: string
): Promise<void> {
  const [enabled, requiredSeedTime] = await Promise.all([
    isHnrEnabled(),
    getHnrRequiredSeedTime(),
  ]);

  // Unique (user_id, torrent_id): an existing snatch is kept as is
  await db
    .insert(schema.hnrTracking)
    .values({
      id: randomUUID(),
      userId,
      torrentId,
      downloadedAt: new Date(),
      seedTime: 0,
      requiredSeedTime,
      isHnr: false,
      isExempt: !enabled,
    })
    .onConflictDoNothing({
      target: [schema.hnrTracking.userId, schema.hnrTracking.torrentId],
    });
}

/**
 * Update seed time for a user on a torrent.
 * Single statement (runs on every seeder announce): adds the time and marks
 * the requirement as met once reached; exempt or completed entries are left
 * untouched.
 */
export async function updateSeedTime(
  userId: string,
  torrentId: string,
  additionalSeconds: number
): Promise<void> {
  const newSeedTime = sql`${schema.hnrTracking.seedTime} + ${additionalSeconds}`;
  const requirementMet = sql`${newSeedTime} >= ${schema.hnrTracking.requiredSeedTime}`;

  await db
    .update(schema.hnrTracking)
    .set({
      seedTime: newSeedTime,
      isHnr: sql`CASE WHEN ${requirementMet} THEN false ELSE ${schema.hnrTracking.isHnr} END`,
      completedAt: sql`CASE WHEN ${requirementMet} THEN now() ELSE ${schema.hnrTracking.completedAt} END`,
    })
    .where(
      and(
        eq(schema.hnrTracking.userId, userId),
        eq(schema.hnrTracking.torrentId, torrentId),
        eq(schema.hnrTracking.isExempt, false),
        isNull(schema.hnrTracking.completedAt)
      )
    );
}

/**
 * Check and mark HnRs that have exceeded grace period
 */
export async function checkAndMarkHnrs(): Promise<number> {
  const enabled = await isHnrEnabled();
  if (!enabled) return 0;

  const gracePeriod = await getHnrGracePeriod();
  const cutoffDate = new Date(Date.now() - gracePeriod * 1000);

  // Mark as HnR if:
  // - Downloaded before grace period cutoff
  // - Not yet completed
  // - Not exempt
  // - Not already marked as HnR
  const result = await db
    .update(schema.hnrTracking)
    .set({ isHnr: true })
    .where(
      and(
        eq(schema.hnrTracking.isHnr, false),
        eq(schema.hnrTracking.isExempt, false),
        sql`${schema.hnrTracking.completedAt} IS NULL`,
        lt(schema.hnrTracking.downloadedAt, cutoffDate)
      )
    )
    .returning();

  return result.length;
}

/**
 * Get user's HnR count
 */
export async function getUserHnrCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.hnrTracking)
    .where(
      and(
        eq(schema.hnrTracking.userId, userId),
        eq(schema.hnrTracking.isHnr, true)
      )
    );

  return result[0]?.count || 0;
}

/**
 * Get user's HnR entries
 */
export async function getUserHnrEntries(userId: string) {
  return db.query.hnrTracking.findMany({
    where: eq(schema.hnrTracking.userId, userId),
    with: {
      torrent: {
        columns: { id: true, name: true, infoHash: true },
      },
    },
    orderBy: (hnr, { desc }) => [desc(hnr.downloadedAt)],
  });
}

/**
 * Exempt a user from HnR on a specific torrent (admin action)
 */
export async function exemptHnr(entryId: string): Promise<boolean> {
  const result = await db
    .update(schema.hnrTracking)
    .set({ isExempt: true, isHnr: false })
    .where(eq(schema.hnrTracking.id, entryId))
    .returning();

  return result.length > 0;
}

/**
 * Clear HnR status (admin action)
 */
export async function clearHnr(entryId: string): Promise<boolean> {
  const result = await db
    .update(schema.hnrTracking)
    .set({ isHnr: false, completedAt: new Date() })
    .where(eq(schema.hnrTracking.id, entryId))
    .returning();

  return result.length > 0;
}
