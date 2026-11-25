import { describe, expect, it } from 'vitest';
import { canFileAppeal, shouldHoldForSharedIp } from '../shared/utils/multiAccount';

const member = { isAdmin: false, isModerator: false, ipExempt: false, ipHold: false };
const clean = { isBanned: false, ipHold: false, ipExempt: false };

describe('shouldHoldForSharedIp', () => {
  it('holds an account sharing its IP with an active one', () => {
    expect(shouldHoldForSharedIp(member, [clean])).toBe(true);
  });

  it('does nothing when the IP is free', () => {
    expect(shouldHoldForSharedIp(member, [])).toBe(false);
  });

  it('ignores banned, held and exempt accounts on the same IP', () => {
    expect(shouldHoldForSharedIp(member, [{ ...clean, isBanned: true }])).toBe(false);
    // The first account stays free once the second one is held
    expect(shouldHoldForSharedIp(member, [{ ...clean, ipHold: true }])).toBe(false);
    // An approved appeal does not put the original account on hold
    expect(shouldHoldForSharedIp(member, [{ ...clean, ipExempt: true }])).toBe(false);
  });

  it('never holds staff, exempt or already held accounts', () => {
    expect(shouldHoldForSharedIp({ ...member, isAdmin: true }, [clean])).toBe(false);
    expect(shouldHoldForSharedIp({ ...member, isModerator: true }, [clean])).toBe(false);
    expect(shouldHoldForSharedIp({ ...member, ipExempt: true }, [clean])).toBe(false);
    expect(shouldHoldForSharedIp({ ...member, ipHold: true }, [clean])).toBe(false);
  });

  it('holds when one account in good standing remains among others', () => {
    expect(shouldHoldForSharedIp(member, [{ ...clean, isBanned: true }, clean])).toBe(true);
  });
});

describe('canFileAppeal', () => {
  it('allows a first appeal and a new one after a decision', () => {
    expect(canFileAppeal(null)).toBe(true);
    expect(canFileAppeal({ status: 'rejected' })).toBe(true);
  });

  it('refuses while one is pending', () => {
    expect(canFileAppeal({ status: 'pending' })).toBe(false);
  });
});
