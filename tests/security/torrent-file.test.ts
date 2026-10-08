import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import bencode from 'bencode';
import { stripAnnounceUrls } from '../../server/utils/torrentFile';

function makeTorrent() {
  const info = {
    name: 'file.bin',
    'piece length': 16384,
    pieces: Buffer.alloc(20),
    length: 1,
    private: 1,
  };
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

describe('stripAnnounceUrls', () => {
  it('removes the uploader passkey and keeps the info hash', () => {
    const { data, infoHash } = makeTorrent();
    const stripped = stripAnnounceUrls(data, infoHash);

    expect(stripped.toString('latin1')).not.toContain('uploadersecret');
    const decoded = bencode.decode(stripped);
    const hash = createHash('sha1')
      .update(bencode.encode(decoded.info))
      .digest('hex');
    expect(hash).toBe(infoHash);
  });

  it('returns the original bytes when the hash would change', () => {
    const { data } = makeTorrent();
    const stripped = stripAnnounceUrls(data, 'f'.repeat(40));
    expect(stripped.equals(data)).toBe(true);
  });

  it('returns the original bytes for garbage input', () => {
    const garbage = Buffer.from('not bencode');
    expect(stripAnnounceUrls(garbage, 'a'.repeat(40)).equals(garbage)).toBe(true);
  });
});
