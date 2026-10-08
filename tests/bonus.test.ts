import { describe, it, expect } from 'vitest';
import {
  computeSeedPoints,
  resolvePurchase,
  canBountyAction,
  MAX_ACCRUAL_SECONDS,
} from '../server/utils/bonus';

describe('computeSeedPoints', () => {
  it('pays the daily rate pro rata', () => {
    expect(computeSeedPoints(3600, 24)).toBeCloseTo(1);
    expect(computeSeedPoints(1800, 48)).toBeCloseTo(1);
  });

  it('caps long gaps between announces', () => {
    expect(computeSeedPoints(10 * 3600, 24)).toBe(computeSeedPoints(MAX_ACCRUAL_SECONDS, 24));
  });

  it('ignores invalid input', () => {
    expect(computeSeedPoints(-5, 10)).toBe(0);
    expect(computeSeedPoints(NaN, 10)).toBe(0);
    expect(computeSeedPoints(3600, 0)).toBe(0);
  });
});

describe('resolvePurchase', () => {
  const target = { canUseGifAvatar: false };

  it('maps item types to effects', () => {
    expect(resolvePurchase({ type: 'upload_credit', value: 1024, isActive: true }, target)).toEqual({
      ok: true,
      effect: { kind: 'upload_credit', bytes: 1024 },
    });
    expect(resolvePurchase({ type: 'invite', value: 2, isActive: true }, target)).toEqual({
      ok: true,
      effect: { kind: 'invite', count: 2 },
    });
    expect(resolvePurchase({ type: 'gif_avatar', value: 0, isActive: true }, target)).toEqual({
      ok: true,
      effect: { kind: 'gif_avatar' },
    });
  });

  it('refuses inactive, invalid and already owned items', () => {
    expect(resolvePurchase({ type: 'invite', value: 1, isActive: false }, target).ok).toBe(false);
    expect(resolvePurchase({ type: 'upload_credit', value: 0, isActive: true }, target).ok).toBe(false);
    expect(resolvePurchase({ type: 'hack', value: 1, isActive: true }, target).ok).toBe(false);
    expect(
      resolvePurchase({ type: 'gif_avatar', value: 0, isActive: true }, { canUseGifAvatar: true }).ok
    ).toBe(false);
  });
});

describe('canBountyAction', () => {
  const requester = { userId: 'req', isStaff: false };
  const other = { userId: 'other', isStaff: false };
  const staff = { userId: 'mod', isStaff: true };
  const open = { status: 'open', requesterId: 'req' };
  const claimed = { status: 'claimed', requesterId: 'req' };

  it('lets anyone contribute to or fill an open bounty', () => {
    expect(canBountyAction(open, 'contribute', other)).toBe(true);
    expect(canBountyAction(open, 'fill', other)).toBe(true);
    expect(canBountyAction(claimed, 'fill', other)).toBe(false);
  });

  it('restricts review and cancel to requester or staff', () => {
    expect(canBountyAction(claimed, 'accept', requester)).toBe(true);
    expect(canBountyAction(claimed, 'reject', staff)).toBe(true);
    expect(canBountyAction(claimed, 'accept', other)).toBe(false);
    expect(canBountyAction(open, 'cancel', other)).toBe(false);
    expect(canBountyAction(open, 'cancel', requester)).toBe(true);
    expect(canBountyAction(claimed, 'cancel', requester)).toBe(false);
  });

  it('freezes final states', () => {
    for (const status of ['filled', 'cancelled']) {
      for (const action of ['contribute', 'fill', 'accept', 'reject', 'cancel'] as const) {
        expect(canBountyAction({ status, requesterId: 'req' }, action, staff)).toBe(false);
      }
    }
  });
});
