/**
 * Announce URLs written into downloaded .torrent files.
 *
 * Replicated deployments list the other nodes in TRACKER_BACKUP_HTTP_URLS
 * (comma separated). They go into later tiers of announce-list (BEP 12):
 * clients try them in order only when the primary tracker does not answer,
 * so tracker failover needs no DNS change.
 */

export function trackerBackupUrls(value = process.env.TRACKER_BACKUP_HTTP_URLS): string[] {
  return (value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function withPasskey(url: string, passkey: string): Buffer {
  const parsed = new URL(url);
  parsed.searchParams.set('passkey', passkey);
  return Buffer.from(parsed.toString());
}

/** Point a decoded torrent at our tracker(s) with the user's passkey. */
export function personalizeAnnounce(
  decoded: Record<string, unknown>,
  primaryUrl: string,
  backupUrls: string[],
  passkey: string
): void {
  const primary = withPasskey(primaryUrl, passkey);
  decoded.announce = primary;

  // Only our trackers: drop whatever list the uploader's client wrote
  if (backupUrls.length > 0 || decoded['announce-list']) {
    decoded['announce-list'] = [
      [primary],
      ...backupUrls.map((url) => [withPasskey(url, passkey)]),
    ];
  }
}
