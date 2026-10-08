/**
 * Bonus points (issue #48)
 *
 * Pure rules (seeding accrual, shop effects, bounty transitions) are kept
 * free of DB access so they can be unit tested; `changeBonusPoints` is the
 * single place balances move, always with a ledger entry.
 */

import { randomUUID } from 'crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { db as Db } from '../db';
import { bonusTransactions, users } from '../db/schema';

// ============================================================================
// Seeding accrual
// ============================================================================

/** Announces further apart than this do not earn more (client went away) */
export const MAX_ACCRUAL_SECONDS = 3600;

export function computeSeedPoints(
  elapsedSeconds: number,
  pointsPerDay: number
): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  if (!Number.isFinite(pointsPerDay) || pointsPerDay <= 0) return 0;
  const seconds = Math.min(elapsedSeconds, MAX_ACCRUAL_SECONDS);
  return (pointsPerDay * seconds) / 86400;
}

// ============================================================================
// Shop
// ============================================================================

export const SHOP_ITEM_TYPES = ['upload_credit', 'gif_avatar', 'invite'] as const;
export type ShopItemType = (typeof SHOP_ITEM_TYPES)[number];

export interface PurchaseTarget {
  canUseGifAvatar: boolean;
}

export type PurchaseEffect =
  | { kind: 'upload_credit'; bytes: number }
  | { kind: 'gif_avatar' }
  | { kind: 'invite'; count: number };

/**
 * Resolve what buying an item does, or why it cannot be bought.
 */
export function resolvePurchase(
  item: { type: string; value: number; isActive: boolean },
  target: PurchaseTarget
): { ok: true; effect: PurchaseEffect } | { ok: false; reason: string } {
  if (!item.isActive) return { ok: false, reason: 'Item is not available' };

  switch (item.type) {
    case 'upload_credit':
      if (!(item.value > 0)) return { ok: false, reason: 'Invalid item' };
      return { ok: true, effect: { kind: 'upload_credit', bytes: item.value } };
    case 'invite':
      if (!(item.value > 0)) return { ok: false, reason: 'Invalid item' };
      return { ok: true, effect: { kind: 'invite', count: item.value } };
    case 'gif_avatar':
      if (target.canUseGifAvatar) {
        return { ok: false, reason: 'You already own this item' };
      }
      return { ok: true, effect: { kind: 'gif_avatar' } };
    default:
      return { ok: false, reason: 'Invalid item' };
  }
}

// ============================================================================
// Bounties
// ============================================================================

export type BountyStatus = 'open' | 'claimed' | 'filled' | 'cancelled';
export type BountyAction = 'contribute' | 'fill' | 'accept' | 'reject' | 'cancel';

export interface BountyActor {
  userId: string;
  isStaff: boolean;
}

/**
 * Who may do what on a bounty, given its state.
 * - open: anyone contributes or submits a fill; requester/staff cancel
 * - claimed (fill pending review): requester/staff accept or reject
 * - filled / cancelled: final
 */
export function canBountyAction(
  bounty: { status: string; requesterId: string },
  action: BountyAction,
  actor: BountyActor
): boolean {
  const isOwnerOrStaff = actor.userId === bounty.requesterId || actor.isStaff;

  switch (action) {
    case 'contribute':
      return bounty.status === 'open';
    case 'fill':
      return bounty.status === 'open';
    case 'accept':
    case 'reject':
      return bounty.status === 'claimed' && isOwnerOrStaff;
    case 'cancel':
      return bounty.status === 'open' && isOwnerOrStaff;
    default:
      return false;
  }
}

// ============================================================================
// Balance changes
// ============================================================================

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export class InsufficientPointsError extends Error {
  constructor() {
    super('Not enough bonus points');
  }
}

/**
 * Move a user's balance and record it in the ledger, inside `tx`.
 * Debits fail atomically (no negative balance, safe against races).
 */
export async function changeBonusPoints(
  tx: Tx,
  entry: {
    userId: string;
    amount: number;
    type: string;
    description?: string;
    refId?: string;
  }
): Promise<void> {
  if (!Number.isFinite(entry.amount) || entry.amount === 0) return;

  const conditions = [eq(users.id, entry.userId)];
  if (entry.amount < 0) {
    conditions.push(gte(users.bonusPoints, -entry.amount));
  }

  const updated = await tx
    .update(users)
    .set({ bonusPoints: sql`${users.bonusPoints} + ${entry.amount}` })
    .where(and(...conditions))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new InsufficientPointsError();
  }

  await tx.insert(bonusTransactions).values({
    id: randomUUID(),
    userId: entry.userId,
    amount: entry.amount,
    type: entry.type,
    description: entry.description,
    refId: entry.refId,
  });
}

/**
 * Convert InsufficientPointsError into a 400 for API handlers
 */
export function rethrowBonusError(err: unknown): never {
  if (err instanceof InsufficientPointsError) {
    throw createError({ statusCode: 400, message: err.message });
  }
  throw err;
}

/**
 * Throw 403 when the bonus system is disabled
 */
export async function requireBonusEnabled(): Promise<void> {
  const { getBonusSettings } = await import('./settings');
  const settings = await getBonusSettings();
  if (!settings.enabled) {
    throw createError({ statusCode: 403, message: 'Bonus system is disabled' });
  }
}

/**
 * Award the upload bonus once per torrent, when it becomes approved
 */
export async function awardUploadBonus(
  database: typeof Db,
  torrent: { id: string; uploaderId: string | null; name: string }
): Promise<void> {
  if (!torrent.uploaderId) return;

  const { getBonusSettings } = await import('./settings');
  const settings = await getBonusSettings();
  if (!settings.enabled || settings.pointsPerUpload <= 0) return;

  await database.transaction(async (tx) => {
    const [already] = await tx
      .select({ id: bonusTransactions.id })
      .from(bonusTransactions)
      .where(
        and(
          eq(bonusTransactions.type, 'upload'),
          eq(bonusTransactions.refId, torrent.id)
        )
      )
      .limit(1);
    if (already) return;

    await changeBonusPoints(tx, {
      userId: torrent.uploaderId!,
      amount: settings.pointsPerUpload,
      type: 'upload',
      description: torrent.name,
      refId: torrent.id,
    });
  });
}
