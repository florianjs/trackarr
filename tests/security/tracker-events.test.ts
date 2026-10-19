import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/redis/client', () => ({ redis: {} }));
vi.mock('../../server/utils/logger', () => ({ securityLogger: { warn() {}, error() {} } }));

const { parseTrackerEvent, trackerEventAlert } = await import('../../server/utils/trackerEvents');
const { SecurityAlertType } = await import('../../server/utils/alerts');

describe('tracker abuse events', () => {
  it('parses the JSON the tracker writes', () => {
    expect(
      parseTrackerEvent('{"kind":"blocked_client","ip":"203.0.113.5","failures":120,"at":42}')
    ).toEqual({ kind: 'blocked_client', ip: '203.0.113.5', failures: 120, at: 42 });
    expect(parseTrackerEvent('{"kind":"other"}')).toBeNull();
    expect(parseTrackerEvent('not json')).toBeNull();
  });

  it('maps a blocked client to a brute force alert per IP', () => {
    const alert = trackerEventAlert({ kind: 'blocked_client', ip: '203.0.113.5', failures: 120, at: 0 });
    expect(alert.type).toBe(SecurityAlertType.BRUTE_FORCE_DETECTED);
    expect(alert.subject).toBe('tracker:203.0.113.5');
  });

  it('maps an impossible upload to a ratio cheat alert per user', () => {
    const alert = trackerEventAlert(
      {
        kind: 'impossible_upload',
        ip: '203.0.113.5',
        user_id: 'u1',
        info_hash: 'ab'.repeat(20),
        claimed: 5 * 1024 ** 4,
        at: 0,
      },
      'alice'
    );
    expect(alert.type).toBe(SecurityAlertType.RATIO_CHEAT_SUSPECTED);
    expect(alert.subject).toBe('cheat:u1');
    expect(alert.description).toContain('alice claimed 5120.0 GiB');
  });
});
