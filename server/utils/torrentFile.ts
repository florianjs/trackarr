import { createHash } from 'crypto';
import bencode from 'bencode';

export interface NormalizedTorrent {
  /** .torrent bytes to store and serve */
  data: Buffer;
  /** Info hash of the stored info dict: what clients will announce */
  infoHash: string;
  /** True when the uploaded file was not flagged private */
  madePrivate: boolean;
}

/**
 * Normalize an uploaded .torrent before storing it:
 * - force info.private = 1 (no DHT/PEX on a private tracker)
 * - remove announce URLs: uploaders usually build torrents with their
 *   personal announce URL, which embeds their passkey; downloads get a fresh
 *   per-user announce anyway
 *
 * The info hash is computed from the stored info dict, so the hash in the DB
 * always matches the file users download. Changing the private flag changes
 * the hash: the uploader must re-download the .torrent to seed it.
 */
export function normalizeTorrent(data: Uint8Array): NormalizedTorrent {
  const decoded = bencode.decode(Buffer.from(data));
  if (!decoded || typeof decoded !== 'object' || !decoded.info) {
    throw new Error('Invalid torrent: missing info dictionary');
  }

  const madePrivate = decoded.info.private !== 1;
  decoded.info.private = 1;
  delete decoded.announce;
  delete decoded['announce-list'];

  const infoHash = createHash('sha1')
    .update(bencode.encode(decoded.info))
    .digest('hex');

  return { data: Buffer.from(bencode.encode(decoded)), infoHash, madePrivate };
}
