import { describe, it, expect } from 'vitest';
import { personalizeAnnounce, trackerBackupUrls } from '../server/utils/announce';

const str = (value: unknown) => (value as Buffer).toString();
const tiers = (decoded: Record<string, unknown>) =>
  (decoded['announce-list'] as Buffer[][]).map((tier) => tier.map(str));

describe('trackerBackupUrls', () => {
  it('parses a comma separated list', () => {
    expect(trackerBackupUrls(undefined)).toEqual([]);
    expect(trackerBackupUrls(' https://a/announce, ,https://b/announce ')).toEqual([
      'https://a/announce',
      'https://b/announce',
    ]);
  });

  it('skips malformed entries instead of failing downloads', () => {
    expect(trackerBackupUrls('tracker2.example.com/announce,https://ok/announce,ftp://x/a')).toEqual([
      'https://ok/announce',
    ]);
  });
});

describe('personalizeAnnounce', () => {
  it('sets the primary announce with the passkey', () => {
    const decoded: Record<string, unknown> = { announce: Buffer.from('http://old/announce') };
    personalizeAnnounce(decoded, 'https://t1/announce', [], 'pk1');
    expect(str(decoded.announce)).toBe('https://t1/announce?passkey=pk1');
    expect(decoded['announce-list']).toBeUndefined();
  });

  it('replaces an existing announce-list with our tracker only', () => {
    const decoded: Record<string, unknown> = {
      'announce-list': [[Buffer.from('http://public/announce')]],
    };
    personalizeAnnounce(decoded, 'https://t1/announce', [], 'pk1');
    expect(tiers(decoded)).toEqual([['https://t1/announce?passkey=pk1']]);
  });

  it('adds one fallback tier per backup node', () => {
    const decoded: Record<string, unknown> = {};
    personalizeAnnounce(
      decoded,
      'https://t1/announce',
      ['https://t2/announce', 'https://t3/announce?x=1'],
      'pk1'
    );
    expect(tiers(decoded)).toEqual([
      ['https://t1/announce?passkey=pk1'],
      ['https://t2/announce?passkey=pk1'],
      ['https://t3/announce?x=1&passkey=pk1'],
    ]);
  });
});
