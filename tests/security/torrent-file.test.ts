import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import bencode from 'bencode';
import { normalizeTorrent } from '../../server/utils/torrentFile';

function makeTorrent(isPrivate: boolean) {
  const info: Record<string, unknown> = {
    name: 'file.bin',
    'piece length': 16384,
    pieces: Buffer.alloc(20),
    length: 1,
  };
  if (isPrivate) info.private = 1;
  const data = Buffer.from(
    bencode.encode({
      announce: 'http://tracker/announce?passkey=uploadersecret',
      'announce-list': [['http://tracker/announce?passkey=uploadersecret']],
      info,
    })
  );
  const infoHash = createHash('sha1').update(bencode.encode(info)).digest('hex');
  return { data, infoHash };
}

function hashOf(data: Buffer): string {
  const decoded = bencode.decode(data);
  return createHash('sha1').update(bencode.encode(decoded.info)).digest('hex');
}

describe('normalizeTorrent', () => {
  it('removes the uploader passkey', () => {
    const { data } = makeTorrent(true);
    const normalized = normalizeTorrent(data);
    expect(normalized.data.toString('latin1')).not.toContain('uploadersecret');
  });

  it('keeps the info hash of an already private torrent', () => {
    const { data, infoHash } = makeTorrent(true);
    const normalized = normalizeTorrent(data);
    expect(normalized.madePrivate).toBe(false);
    expect(normalized.infoHash).toBe(infoHash);
  });

  it('makes public torrents private and returns the matching hash (issue #49)', () => {
    const { data, infoHash } = makeTorrent(false);
    const normalized = normalizeTorrent(data);

    expect(normalized.madePrivate).toBe(true);
    expect(bencode.decode(normalized.data).info.private).toBe(1);
    expect(normalized.infoHash).not.toBe(infoHash);
    // The stored hash is the one clients will announce with the served file
    expect(hashOf(normalized.data)).toBe(normalized.infoHash);
  });

  it('rejects files without an info dictionary', () => {
    expect(() => normalizeTorrent(Buffer.from(bencode.encode({ a: 1 })))).toThrow();
  });
});
