import { db, schema } from '../db';
import { eq, and, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  isHnrEnabled,
  getHnrRequiredSeedTime,
  getHnrGracePeriod,
} from './settings';

/**
 * Create HnR tracking entry when user completes a download
 */
export async function createHnrEntry(
  userId: string,
  torrentId: string
): Promise<void> {
  const enabled = await isHnrEnabled();
  if (!enabled) return;

  const requiredSeedTime = await getHnrRequiredSeedTime();

  // Check if entry already exists
  const existing = await db.query.hnrTracking.findFirst({
    where: and(
      eq(schema.hnrTracking.userId, userId),
      eq(schema.hnrTracking.torrentId, torrentId)
    ),
  });

  if (existing) return;

  await db.insert(schema.hnrTracking).values({
    id: randomUUID(),
    userId,
    torrentId,
    downloadedAt: new Date(),
    seedTime: 0,
    requiredSeedTime,
    isHnr: false,
    isExempt: false,
  });
}

/**
 * Update seed time for a user on a torrent
 */
export async function updateSeedTime(
  userId: string,
  torrentId: string,
  additionalSeconds: number
): Promise<void> {
  const entry = await db.query.hnrTracking.findFirst({
    where: and(
      eq(schema.hnrTracking.userId, userId),
      eq(schema.hnrTracking.torrentId, torrentId)
    ),
  });

  if (!entry || entry.isExempt || entry.completedAt) return;

  const newSeedTime = entry.seedTime + additionalSeconds;

  // Check if requirement is now met
  if (newSeedTime >= entry.requiredSeedTime) {
    await db
      .update(schema.hnrTracking)
      .set({
        seedTime: newSeedTime,
        isHnr: false,
        completedAt: new Date(),
      })
      .where(eq(schema.hnrTracking.id, entry.id));
  } else {
    await db
      .update(schema.hnrTracking)
      .set({ seedTime: newSeedTime })
      .where(eq(schema.hnrTracking.id, entry.id));
  }
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
