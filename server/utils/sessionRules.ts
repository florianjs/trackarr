/**
 * Server-side revocation of sealed session cookies. A cookie carries the
 * users.session_version it was issued with; bumping the column (ban, sign out
 * everywhere, panic) invalidates every cookie issued before.
 */
export interface SessionUserState {
  isBanned: boolean;
  sessionVersion: number;
}

export type SessionCheck = 'valid' | 'banned' | 'revoked';

/**
 * Decide whether a session may still be used. Cookies issued before versions
 * existed carry none: they count as version 0, valid until the first bump.
 */
export function checkSession(
  sessionVersion: number | undefined,
  user: SessionUserState | undefined
): SessionCheck {
  if (!user || user.isBanned) return 'banned';
  return (sessionVersion ?? 0) === user.sessionVersion ? 'valid' : 'revoked';
}
