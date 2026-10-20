import { z } from 'zod';

/**
 * Admin corrections of a member's uploaded/downloaded totals (ratio fixes,
 * compensation after a tracker outage, penalties).
 */
export const STAT_UNITS = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
} as const;
export type StatUnit = keyof typeof STAT_UNITS;

// 1 PiB either way: a typo, not a correction
export const MAX_STAT_DELTA = 1024 ** 5;

export const statAdjustmentSchema = z
  .object({
    uploadedDelta: z.number().int().min(-MAX_STAT_DELTA).max(MAX_STAT_DELTA),
    downloadedDelta: z.number().int().min(-MAX_STAT_DELTA).max(MAX_STAT_DELTA),
    reason: z.string().trim().min(1).max(200),
  })
  .refine((v) => v.uploadedDelta !== 0 || v.downloadedDelta !== 0, { message: 'Nothing to change' });
export type StatAdjustmentInput = z.infer<typeof statAdjustmentSchema>;

/** Amount typed in the form, signed, to whole bytes */
export function toBytes(amount: number, unit: StatUnit, remove = false): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const bytes = Math.round(amount * STAT_UNITS[unit]);
  return remove ? -bytes : bytes;
}

/** New total and the delta actually applied: totals never go below 0 */
export function applyStatDelta(current: number, delta: number): { value: number; applied: number } {
  const value = Math.max(0, current + delta);
  return { value, applied: value - current };
}

/** Same rule as the dashboard: nothing downloaded is ∞ once something was uploaded */
export function ratioOf(uploaded: number, downloaded: number): number {
  return downloaded === 0 ? (uploaded > 0 ? Infinity : 0) : uploaded / downloaded;
}
