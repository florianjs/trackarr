/**
 * Abuse reported by the tracker service (tracker/src/events.rs), turned into
 * admin alerts. Pure mapping, so it can be tested without Redis.
 */

import { SecurityAlertType } from './alerts';

export type TrackerAbuseEvent =
  | { kind: 'blocked_client'; ip: string; failures: number; at: number }
  | {
      kind: 'impossible_upload';
      ip: string;
      user_id: string;
      info_hash: string;
      claimed: number;
      at: number;
    };

export interface TrackerAlert {
  type: SecurityAlertType;
  title: string;
  description: string;
  ip: string;
  details?: Record<string, unknown>;
  /** Cooldown subject: one alert per client or user every few minutes */
  subject: string;
}

function gib(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

export function parseTrackerEvent(raw: string): TrackerAbuseEvent | null {
  try {
    const event = JSON.parse(raw) as TrackerAbuseEvent;
    return event.kind === 'blocked_client' || event.kind === 'impossible_upload' ? event : null;
  } catch {
    return null;
  }
}

export function trackerEventAlert(
  event: TrackerAbuseEvent,
  username?: string | null
): TrackerAlert {
  if (event.kind === 'blocked_client') {
    return {
      type: SecurityAlertType.BRUTE_FORCE_DETECTED,
      title: 'Tracker: client refused after failed lookups',
      description: `${event.failures} invalid passkeys or unknown torrents in one minute: refused without database access for the rest of the minute`,
      ip: event.ip,
      subject: `tracker:${event.ip}`,
    };
  }
  return {
    type: SecurityAlertType.RATIO_CHEAT_SUSPECTED,
    title: 'Tracker: impossible upload claimed',
    description: `${username ?? event.user_id} claimed ${gib(event.claimed)} since the previous announce, more than the elapsed time allows: credit was capped. Possible ratio cheat.`,
    ip: event.ip,
    details: { userId: event.user_id, username, infoHash: event.info_hash, claimedBytes: event.claimed },
    subject: `cheat:${event.user_id}`,
  };
}
