// ============================================================================
// BitTorrent Tracker Types
// Strict typing for P2P events from bittorrent-tracker
// ============================================================================

export interface AnnounceParams {
  info_hash: Buffer;
  peer_id: Buffer;
  port: number;
  uploaded: number;
  downloaded: number;
  left: number;
  compact: 0 | 1;
  event?: 'started' | 'stopped' | 'completed' | 'update';
  numwant?: number;
  ip?: string;
  key?: string;
}

export interface ScrapeParams {
  info_hash: Buffer | Buffer[];
}

export interface TrackerPeer {
  peerId: string;
  ip: string;
  port: number;
}

export interface AnnounceEvent {
  type: 'announce';
  infoHash: string; // Hex
  peerId: string; // Hex
  peer: {
    ip: string;
    port: number;
  };
  uploaded: number;
  downloaded: number;
  left: number;
  event: 'started' | 'stopped' | 'completed' | 'update' | null;
  numwant: number;
  compact: boolean;
}

export interface ScrapeEvent {
  type: 'scrape';
  infoHashes: string[]; // Hex
}

export interface TrackerStats {
  infoHash: string;
  complete: number; // Seeders
  incomplete: number; // Leechers
  downloaded: number; // Completed count
}

export interface GlobalTrackerStats {
  torrents: number;
  peers: number;
  seeders: number;
  announces: number;
}

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Convert Buffer/Uint8Array/string to hex string (for info_hash and peer_id)
 * bittorrent-tracker may pass different types depending on protocol (HTTP vs UDP)
 */
export function bufferToHex(
  buf: Buffer | Uint8Array | string | unknown
): string {
  // Handle null/undefined
  if (buf == null) {
    return '';
  }

  // Already a hex string
  if (typeof buf === 'string') {
    // If it looks like hex (40 chars for info_hash, 40 for peer_id), return as-is
    if (/^[a-fA-F0-9]+$/.test(buf)) {
      return buf.toLowerCase();
    }
    // Otherwise it's a binary string, convert to hex
    return Buffer.from(buf, 'binary').toString('hex');
  }

  // Check if it's a Buffer (has toString method with encoding)
  if (Buffer.isBuffer(buf)) {
    return buf.toString('hex');
  }

  // Uint8Array (but not Buffer - Buffer extends Uint8Array)
  if (buf instanceof Uint8Array) {
    return Buffer.from(buf).toString('hex');
  }

  // Handle array-like objects (sometimes bittorrent-tracker passes these)
  if (typeof buf === 'object' && buf !== null) {
    const obj = buf as Record<string, unknown>;
    // If it has a data property (some libraries wrap buffers)
    if ('data' in obj && Array.isArray(obj.data)) {
      return Buffer.from(obj.data as number[]).toString('hex');
    }
    // If it's array-like with numeric keys
    if ('length' in obj && typeof obj.length === 'number') {
      const arr = Array.from(
        { length: obj.length as number },
        (_, i) => obj[i] as number
      );
      return Buffer.from(arr).toString('hex');
    }
  }

  // Last resort: try to convert to string
  console.warn(
    '[Tracker] bufferToHex received unexpected type:',
    typeof buf,
    buf
  );
  return String(buf);
}

/**
 * Convert hex string to Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Check if peer is a seeder (left === 0)
 * Handles number, string, and bigint (UDP tracker often uses bigint)
 */
export function isSeeder(left: number | string | bigint | any): boolean {
  if (left === undefined || left === null) return false;
  return Number(left) === 0;
}
