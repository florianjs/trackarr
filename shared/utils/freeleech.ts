/**
 * Global freeleech: while active, downloaded data does not count against
 * ratios. `until` null means no end date. Shared between app and server.
 */

export interface FreeleechState {
  enabled: boolean;
  until: string | null; // ISO date
}

export function isFreeleechActive(
  state: FreeleechState,
  now: Date = new Date()
): boolean {
  if (!state.enabled) return false;
  if (!state.until) return true;
  const end = new Date(state.until);
  return !Number.isNaN(end.getTime()) && now < end;
}
