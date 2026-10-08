/**
 * Upload/download credit computation
 *
 * Clients report cumulative uploaded/downloaded counters themselves, so the
 * deltas are untrusted input: a modified client can claim terabytes in one
 * announce. Credit is bounded by elapsed time and by whether anyone in the
 * swarm could actually have received the data.
 */

// Default ceiling: 100 MiB/s sustained, far above residential links.
export const DEFAULT_MAX_RATE_BYTES = 100 * 1024 * 1024;

export interface CreditInput {
  previous: { uploaded: number; downloaded: number; updatedAt: number } | null;
  uploaded: number;
  downloaded: number;
  now: number;
  /** Leechers in the swarm other than this peer */
  otherLeechers: number;
  maxRateBytes?: number;
}

export interface Credit {
  uploaded: number;
  downloaded: number;
}

function sanitizeCounter(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function computeCredit(input: CreditInput): Credit {
  // First announce of a session: no baseline, nothing to credit
  if (!input.previous) return { uploaded: 0, downloaded: 0 };

  const maxRate = input.maxRateBytes ?? DEFAULT_MAX_RATE_BYTES;
  const elapsedSec = Math.max(1, (input.now - input.previous.updatedAt) / 1000);
  const ceiling = Math.floor(elapsedSec * maxRate);

  const uploaded = sanitizeCounter(input.uploaded);
  const downloaded = sanitizeCounter(input.downloaded);

  let deltaUploaded = Math.max(0, uploaded - sanitizeCounter(input.previous.uploaded));
  let deltaDownloaded = Math.max(
    0,
    downloaded - sanitizeCounter(input.previous.downloaded)
  );

  // Nobody to upload to: any claimed upload is fake
  if (input.otherLeechers <= 0) deltaUploaded = 0;

  deltaUploaded = Math.min(deltaUploaded, ceiling);
  deltaDownloaded = Math.min(deltaDownloaded, ceiling);

  return { uploaded: deltaUploaded, downloaded: deltaDownloaded };
}

export function getMaxRateBytes(): number {
  const mbps = Number(process.env.TRACKER_MAX_RATE_MIBPS);
  return Number.isFinite(mbps) && mbps > 0
    ? mbps * 1024 * 1024
    : DEFAULT_MAX_RATE_BYTES;
}
