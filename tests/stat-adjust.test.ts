import { describe, it, expect } from 'vitest';
import { MAX_STAT_DELTA, applyStatDelta, ratioOf, statAdjustmentSchema, toBytes } from '../shared/utils/statAdjust';

describe('toBytes', () => {
  it('converts binary units and signs removals', () => {
    expect(toBytes(1, 'GB')).toBe(1024 ** 3);
    expect(toBytes(1.5, 'TB', true)).toBe(-1.5 * 1024 ** 4);
    expect(toBytes(0.5, 'MB')).toBe(524288);
  });

  it('ignores empty, negative and invalid amounts', () => {
    expect(toBytes(0, 'GB')).toBe(0);
    expect(toBytes(-3, 'GB')).toBe(0);
    expect(toBytes(Number.NaN, 'GB')).toBe(0);
  });
});

describe('applyStatDelta', () => {
  it('adds and removes', () => {
    expect(applyStatDelta(100, 50)).toEqual({ value: 150, applied: 50 });
    expect(applyStatDelta(100, -40)).toEqual({ value: 60, applied: -40 });
  });

  it('never goes below zero and reports what was really removed', () => {
    expect(applyStatDelta(100, -500)).toEqual({ value: 0, applied: -100 });
    expect(applyStatDelta(0, -1)).toEqual({ value: 0, applied: 0 });
  });
});

describe('ratioOf', () => {
  it('matches the dashboard rule', () => {
    expect(ratioOf(0, 0)).toBe(0);
    expect(ratioOf(10, 0)).toBe(Infinity);
    expect(ratioOf(30, 20)).toBe(1.5);
  });
});

describe('statAdjustmentSchema', () => {
  const base = { uploadedDelta: 0, downloadedDelta: 1024, reason: 'Tracker outage' };

  it('accepts a correction with a reason', () => {
    expect(statAdjustmentSchema.safeParse(base).success).toBe(true);
  });

  it('rejects empty changes, missing reasons and absurd amounts', () => {
    expect(statAdjustmentSchema.safeParse({ ...base, downloadedDelta: 0 }).success).toBe(false);
    expect(statAdjustmentSchema.safeParse({ ...base, reason: '   ' }).success).toBe(false);
    expect(statAdjustmentSchema.safeParse({ ...base, uploadedDelta: MAX_STAT_DELTA + 1 }).success).toBe(false);
    expect(statAdjustmentSchema.safeParse({ ...base, uploadedDelta: 1.5 }).success).toBe(false);
  });
});
