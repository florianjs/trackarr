import { createHash } from 'crypto';
import bencode from 'bencode';

/**
 * Remove announce URLs from an uploaded .torrent before storing it.
 * Uploaders usually build torrents with their personal announce URL, which
 * embeds their passkey; downloads get a fresh per-user announce anyway.
 * Returns the original bytes if re-encoding would change the info hash
 * (non-canonical bencode), since the info dict must stay byte-identical.
 */
export function stripAnnounceUrls(data: Uint8Array, infoHash: string): Buffer {
  try {
    const decoded = bencode.decode(Buffer.from(data));
    if (!decoded || typeof decoded !== 'object' || !decoded.info) {
      return Buffer.from(data);
    }

    const reencodedInfo = bencode.encode(decoded.info);
    const hash = createHash('sha1').update(reencodedInfo).digest('hex');
    if (hash !== infoHash.toLowerCase()) {
      return Buffer.from(data);
    }

    delete decoded.announce;
    delete decoded['announce-list'];
    return Buffer.from(bencode.encode(decoded));
  } catch {
    return Buffer.from(data);
  }
}
