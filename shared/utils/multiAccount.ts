/**
 * Multi-account guard: an account signing up or in from an IP already used by
 * another active account is held until staff review its appeal (family,
 * flatmates, shared connection).
 */

export interface IpAccount {
  isBanned: boolean;
  ipHold: boolean;
  ipExempt: boolean;
}

export interface IpSubject {
  isAdmin: boolean;
  isModerator: boolean;
  ipExempt: boolean;
  ipHold: boolean;
}

/**
 * Hold `self` when another account on the same IP is in good standing.
 * Banned and held accounts do not count (the first account stays free when
 * the second is the one held), nor do exempt ones (an approved appeal must
 * not put the original account on hold). Staff and exempt accounts, and
 * accounts already held, are never (re)held.
 */
export function shouldHoldForSharedIp(self: IpSubject, others: IpAccount[]): boolean {
  if (self.isAdmin || self.isModerator || self.ipExempt || self.ipHold) return false;
  return others.some((o) => !o.isBanned && !o.ipHold && !o.ipExempt);
}

export const APPEAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const APPEAL_MIN_LENGTH = 10;
export const APPEAL_MAX_LENGTH = 1000;

/** A held account may file a new appeal unless one is still waiting */
export function canFileAppeal(latest: { status: string } | null | undefined): boolean {
  return !latest || latest.status !== 'pending';
}
