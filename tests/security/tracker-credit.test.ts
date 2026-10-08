import { describe, it, expect } from 'vitest';
import { computeCredit, DEFAULT_MAX_RATE_BYTES } from '../../server/tracker/credit';

const t0 = 1_000_000;
const prev = { uploaded: 0, downloaded: 0, updatedAt: t0 };

describe('computeCredit', () => {
  it('credits nothing on the first announce', () => {
    expect(
      computeCredit({ previous: null, uploaded: 1e12, downloaded: 0, now: t0, otherLeechers: 5 })
    ).toEqual({ uploaded: 0, downloaded: 0 });
  });

  it('credits realistic deltas', () => {
    const credit = computeCredit({
      previous: prev,
      uploaded: 50 * 1024 * 1024,
      downloaded: 10 * 1024 * 1024,
      now: t0 + 60_000,
      otherLeechers: 2,
    });
    expect(credit).toEqual({ uploaded: 50 * 1024 * 1024, downloaded: 10 * 1024 * 1024 });
  });

  it('caps a 10 TiB claim to the elapsed-time ceiling', () => {
    const credit = computeCredit({
      previous: prev,
      uploaded: 10 * 1024 ** 4,
      downloaded: 0,
      now: t0 + 10_000,
      otherLeechers: 3,
    });
    expect(credit.uploaded).toBe(10 * DEFAULT_MAX_RATE_BYTES);
  });

  it('credits no upload when there is nobody to upload to', () => {
    const credit = computeCredit({
      previous: prev,
      uploaded: 1024,
      downloaded: 0,
      now: t0 + 60_000,
      otherLeechers: 0,
    });
    expect(credit.uploaded).toBe(0);
  });

  it('ignores non-finite and negative counters', () => {
    expect(
      computeCredit({
        previous: prev,
        uploaded: Infinity,
        downloaded: -5,
        now: t0 + 60_000,
        otherLeechers: 1,
      })
    ).toEqual({ uploaded: 0, downloaded: 0 });
  });

  it('never credits counters going backwards', () => {
    expect(
      computeCredit({
        previous: { uploaded: 500, downloaded: 500, updatedAt: t0 },
        uploaded: 100,
        downloaded: 100,
        now: t0 + 60_000,
        otherLeechers: 1,
      })
    ).toEqual({ uploaded: 0, downloaded: 0 });
  });
});
