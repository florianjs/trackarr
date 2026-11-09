import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import bencode from 'bencode';
import parseTorrent from 'parse-torrent';
import { buildTorrent, isJunkFile, pickPieceLength } from '../shared/utils/release/torrent';
import {
  channelLayout,
  cleanMediaInfoText,
  resolutionLabel,
  summarizeMediaInfo,
} from '../shared/utils/release/mediainfo';
import { parseReleaseName } from '../shared/utils/release/releaseName';
import {
  buildDescription,
  escapeBbcode,
  formatDuration,
  formatSize,
  languageName,
} from '../shared/utils/release/description';
import { DESCRIPTION_LABELS, DESCRIPTION_LANGUAGES } from '../shared/utils/release/labels';
import { bbcodeToHtml, looksLikeBbcode } from '../shared/utils/bbcode';
import { normalizeTorrent } from '../server/utils/torrentFile';

const sha1 = async (data: Uint8Array) => new Uint8Array(createHash('sha1').update(data).digest());

function memoryFile(path: string[], bytes: Uint8Array) {
  return {
    path,
    length: bytes.length,
    read: async (offset: number, length: number) => bytes.slice(offset, offset + length),
  };
}

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 251);

describe('torrent builder', () => {
  it('picks a power-of-two piece size within bounds', () => {
    expect(pickPieceLength(1)).toBe(16 * 1024);
    expect(pickPieceLength(700 * 1024 ** 2)).toBe(512 * 1024);
    expect(pickPieceLength(50 * 1024 ** 3)).toBe(16 * 1024 ** 2);
    expect(pickPieceLength(5 * 1024 ** 4)).toBe(16 * 1024 ** 2);
  });

  it('hashes pieces across file boundaries like other clients', async () => {
    const a = bytes(40_000, 1);
    const b = bytes(30_000, 7);
    const built = await buildTorrent({
      name: 'Release',
      folder: true,
      files: [memoryFile(['a.mkv'], a), memoryFile(['sub', 'b.srt'], b)],
      announce: 'https://tracker.example/announce?passkey=abc',
      source: 'tracker.example',
      pieceLength: 16 * 1024,
      sha1,
      concurrency: 3,
      creationDate: 1_700_000_000,
    });

    // Expected pieces: SHA-1 of the concatenated stream cut every 16 KiB
    const all = new Uint8Array([...a, ...b]);
    const expected: Buffer[] = [];
    for (let i = 0; i < all.length; i += 16 * 1024) {
      expected.push(createHash('sha1').update(all.slice(i, i + 16 * 1024)).digest());
    }
    const decoded = bencode.decode(built.torrent);
    expect(Buffer.from(decoded.info.pieces)).toEqual(Buffer.concat(expected));
    expect(decoded.info.private).toBe(1);
    expect(Buffer.from(decoded.info.source).toString()).toBe('tracker.example');
    expect(decoded.info.files.map((f: { path: Uint8Array[] }) => f.path.map((p) => Buffer.from(p).toString()))).toEqual([
      ['a.mkv'],
      ['sub', 'b.srt'],
    ]);
    expect(built.totalSize).toBe(70_000);

    const parsed = await parseTorrent(Buffer.from(built.torrent));
    expect(parsed.infoHash).toBe(built.infoHash);
  });

  it('keeps its info hash once the tracker stores it', async () => {
    const built = await buildTorrent({
      name: 'movie.mkv',
      files: [memoryFile(['movie.mkv'], bytes(100_000, 3))],
      announce: 'https://tracker.example/announce?passkey=abc',
      sha1,
    });
    const stored = normalizeTorrent(built.torrent);
    expect(stored.madePrivate).toBe(false);
    expect(stored.infoHash).toBe(built.infoHash);
    expect(bencode.decode(built.torrent).info.length).toBe(100_000);
  });

  it('skips empty files and refuses an empty release', async () => {
    await expect(
      buildTorrent({ name: 'x', files: [memoryFile(['x'], new Uint8Array())], announce: 'a', sha1 })
    ).rejects.toThrow(/empty/);
    expect(isJunkFile('.DS_Store')).toBe(true);
    expect(isJunkFile('._movie.mkv')).toBe(true);
    expect(isJunkFile('movie.mkv')).toBe(false);
  });
});

const MEDIAINFO = {
  media: {
    track: [
      { '@type': 'General', Format: 'Matroska', Duration: '7922.112', FileSize: '25123456789', OverallBitRate: '25372000' },
      {
        '@type': 'Video', Format: 'HEVC', Format_Profile: 'Main 10@L5.1@High', Width: '3840', Height: '1600',
        FrameRate: '23.976', BitRate: '22000000', BitDepth: '10',
        HDR_Format: 'Dolby Vision / SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10',
      },
      { '@type': 'Audio', Format: 'E-AC-3', Format_AdditionalFeatures: 'JOC', Format_Commercial_IfAny: 'Dolby Digital Plus', Channels: '6', BitRate: '768000', Language: 'fr', Title: 'VFF' },
      { '@type': 'Audio', Format: 'AAC', Channels: '2', BitRate: '128000', Language: 'en' },
      { '@type': 'Text', Format: 'UTF-8', Language: 'fr', Forced: 'Yes' },
      { '@type': 'Text', Format: 'PGS', Language: 'en' },
    ],
  },
};

describe('mediainfo', () => {
  it('summarizes tracks', () => {
    const s = summarizeMediaInfo(JSON.stringify(MEDIAINFO));
    expect(s.container).toBe('Matroska');
    expect(s.video[0]).toMatchObject({ codec: 'H.265 (HEVC) Main 10', width: 3840, hdr: 'Dolby Vision + HDR10', bitDepth: 10 });
    expect(resolutionLabel(s.video[0])).toBe('2160p');
    expect(s.audio[0]).toMatchObject({ codec: 'Dolby Digital Plus Atmos', channels: '5.1', language: 'fr', title: 'VFF' });
    expect(s.subtitles).toEqual([
      { format: 'UTF-8', language: 'fr', title: null, forced: true },
      { format: 'PGS', language: 'en', title: null, forced: false },
    ]);
    expect(channelLayout(8)).toBe('7.1');
    expect(channelLayout(2)).toBe('2.0');
  });

  it('copes with garbage', () => {
    expect(summarizeMediaInfo({})).toMatchObject({ container: null, video: [], audio: [] });
  });

  it('removes the local path from the text report', () => {
    const text = 'General\nComplete name                            : /home/alice/Downloads/Movie.mkv\r\nFormat : Matroska';
    expect(cleanMediaInfoText(text)).toBe('General\nComplete name                            : Movie.mkv\nFormat : Matroska');
    expect(cleanMediaInfoText('Complete name : C:\\Users\\bob\\x.mkv')).toBe('Complete name : x.mkv');
  });
});

describe('release names', () => {
  it('reads movies and episodes', () => {
    expect(parseReleaseName('The.Movie.Title.2021.2160p.UHD.BluRay.REMUX.HDR.HEVC.Atmos-GROUP.mkv')).toEqual({
      title: 'The Movie Title', year: 2021, season: null, episode: null, resolution: '2160p', source: 'Remux', group: 'GROUP',
    });
    expect(parseReleaseName('Show.Name.S02E05.1080p.WEB-DL.DDP5.1.H.264-NTb')).toMatchObject({
      title: 'Show Name', season: 2, episode: 5, resolution: '1080p', source: 'WEB-DL', group: 'NTb',
    });
    expect(parseReleaseName('Holiday photos')).toMatchObject({ title: 'Holiday photos', year: null, group: null });
  });
});

describe('description', () => {
  it('has every label in every language', () => {
    const keys = Object.keys(DESCRIPTION_LABELS.en).sort();
    for (const lang of DESCRIPTION_LANGUAGES) {
      expect(Object.keys(DESCRIPTION_LABELS[lang]).sort()).toEqual(keys);
    }
  });

  it('formats in the chosen language', () => {
    expect(formatSize(25_123_456_789, 'fr')).toBe('23,4 Go');
    expect(formatSize(25_123_456_789, 'en')).toBe('23.4 GB');
    expect(formatDuration(7922, 'fr')).toBe('2 h 12 min');
    expect(languageName('fr', 'fr')).toBe('Français');
    expect(languageName('fr', 'en')).toBe('French');
    expect(languageName('not a code', 'en')).toBe('not a code');
  });

  it('builds a BBCode description that renders', () => {
    const text = buildDescription({
      lang: 'fr',
      title: 'The Movie [Director cut]',
      release: parseReleaseName('The.Movie.2021.2160p.BluRay.REMUX-GROUP'),
      summary: summarizeMediaInfo(MEDIAINFO),
      mediaInfoText: 'General\nFormat : Matroska [/code] tricky',
      screenshots: [
        { page: 'https://pixhost.to/show/1/a.jpg', thumb: 'https://t1.pixhost.to/thumbs/1/a.jpg' },
        { page: 'javascript:alert(1)', thumb: 'https://t1.pixhost.to/thumbs/1/b.jpg' },
      ],
      files: [
        { path: 'The.Movie/movie.mkv', size: 1000 },
        { path: 'The.Movie/subs/fr.srt', size: 2000 },
      ],
    });
    expect(text).toContain('[b]The Movie (Director cut) (2021)[/b]');
    expect(text).toContain('[b]Team:[/b] GROUP');
    expect(text).toContain('[*]Français · Dolby Digital Plus Atmos · 5.1 · 768 kb/s · "VFF"');
    expect(text).toContain('[*]Français (forcés) · UTF-8');
    expect(text).toContain('[url=https://pixhost.to/show/1/a.jpg][img]https://t1.pixhost.to/thumbs/1/a.jpg[/img][/url]');
    expect(text).not.toContain('javascript:');
    expect(text).toContain('[spoiler=Fichiers (2)]');
    expect(looksLikeBbcode(text)).toBe(true);

    const html = bbcodeToHtml(text);
    expect(html).toContain('<details><summary>MediaInfo</summary><pre><code>General\nFormat : Matroska [/c0de] tricky</code></pre></details>');
    expect(html).toContain('<a href="https://pixhost.to/show/1/a.jpg" rel="nofollow noopener noreferrer"><img src="https://t1.pixhost.to/thumbs/1/a.jpg" alt="" loading="lazy"></a>');
    expect(html).toContain('<li>Français (forcés) · UTF-8</li>');
    expect(html).not.toMatch(/\[\/?(b|list|center|spoiler|size)/);
    expect(escapeBbcode('[b]x[/b]')).toBe('(b)x(/b)');
  });
});

describe('bbcode rendering', () => {
  it('renders the supported tags', () => {
    expect(bbcodeToHtml('[b]bold[/b] [i]it[/i] [u]u[/u] [s]s[/s]')).toBe(
      '<strong>bold</strong> <em>it</em> <u>u</u> <s>s</s>'
    );
    expect(bbcodeToHtml('[center][size=6]Big[/size][/center]')).toBe(
      '<div style="text-align:center"><span style="font-size:1.75em">Big</span></div>'
    );
    expect(bbcodeToHtml('[color=#ff0000]red[/color][color=red]r[/color]')).toBe(
      '<span style="color:#ff0000">red</span><span style="color:red">r</span>'
    );
    expect(bbcodeToHtml('[list]\n[*]one\n[*]two\n[/list]')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(bbcodeToHtml('[list=1][*]a[/list]')).toBe('<ol><li>a</li></ol>');
    expect(bbcodeToHtml('[quote=Bob]hi[/quote]')).toBe('<blockquote><cite>Bob</cite>hi</blockquote>');
    expect(bbcodeToHtml('[url]https://a.example/x[/url]')).toBe(
      '<a href="https://a.example/x" rel="nofollow noopener noreferrer">https://a.example/x</a>'
    );
    expect(bbcodeToHtml('line1\nline2')).toBe('line1<br>line2');
    expect(bbcodeToHtml('[spoiler]x[/spoiler]')).toBe('<details><summary>Spoiler</summary>x</details>');
    expect(bbcodeToHtml('a[hr]b')).toBe('a<hr>b');
  });

  it('never lets markup or unsafe URLs through', () => {
    expect(bbcodeToHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(bbcodeToHtml('[url=javascript:alert(1)]x[/url]')).toBe('x');
    expect(bbcodeToHtml('[url="onmouseover=alert(1)]x[/url]')).toBe('x');
    expect(bbcodeToHtml('[img]javascript:alert(1)[/img]')).toBe('javascript:alert(1)');
    expect(bbcodeToHtml('[img]https://a.example/x.png" onerror="alert(1)[/img]')).toBe(
      'https://a.example/x.png&quot; onerror=&quot;alert(1)'
    );
    expect(bbcodeToHtml('[color=red;background:url(x)]x[/color]')).toBe('x');
    expect(bbcodeToHtml('[size=99]x[/size]')).toBe('x');
    expect(bbcodeToHtml('[quote=<b>]x[/quote]')).toBe('<blockquote><cite>&lt;b&gt;</cite>x</blockquote>');
    expect(bbcodeToHtml('[code][b]raw[/b] <i>[/code]')).toBe('<pre><code>[b]raw[/b] &lt;i&gt;</code></pre>');
  });

  it('keeps broken BBCode as text', () => {
    expect(bbcodeToHtml('[b]open')).toBe('[b]open');
    expect(bbcodeToHtml('close[/b]')).toBe('close[/b]');
    expect(bbcodeToHtml('[foo]x[/foo]')).toBe('[foo]x[/foo]');
    // An inner tag closed by its parent still renders (forgiving, like forums)
    expect(bbcodeToHtml('[b][i]x[/b]')).toBe('<strong><em>x</em></strong>');
  });

  it('tells BBCode from Markdown', () => {
    expect(looksLikeBbcode('**bold** and [link](https://x.example)')).toBe(false);
    expect(looksLikeBbcode('[b]x[/b]')).toBe(true);
    expect(looksLikeBbcode('array[i] = x[0]')).toBe(false);
  });
});

describe('pixhost answers', () => {
  it('accepts only https links on Pixhost domains', async () => {
    const { isPixhostUrl } = await import('../server/utils/pixhost');
    expect(isPixhostUrl('https://pixhost.to/show/1/a.jpg')).toBe(true);
    expect(isPixhostUrl('https://t3.pixhost.to/thumbs/1/a.jpg')).toBe(true);
    expect(isPixhostUrl('https://img1.pixho.st/images/1/a.jpg')).toBe(true);
    expect(isPixhostUrl('http://pixhost.to/show/1/a.jpg')).toBe(false);
    expect(isPixhostUrl('https://pixhost.to.evil.example/a.jpg')).toBe(false);
    expect(isPixhostUrl('javascript:alert(1)')).toBe(false);
    expect(isPixhostUrl(42)).toBe(false);
  });
});

describe('review fixes', () => {
  it('detects BBCode in linear time on hostile input', () => {
    const hostile = '[b]'.repeat(16_000);
    const start = performance.now();
    expect(looksLikeBbcode(hostile)).toBe(false);
    expect(looksLikeBbcode(`${hostile}[/b]`)).toBe(true);
    expect(performance.now() - start).toBeLessThan(200);
    expect(looksLikeBbcode('[/b] then [b]')).toBe(false);
  });

  it('renders deep nesting without overflowing the stack', () => {
    const html = bbcodeToHtml(`${'[b]'.repeat(16_000)}x${'[/b]'.repeat(16_000)}`);
    expect(html.match(/<strong>/g)?.length).toBeLessThanOrEqual(33);
    expect(html).toContain('[b]');
  });

  it('keeps MediaInfo inside its code block, whatever the closing form', () => {
    const text = buildDescription({
      lang: 'en',
      title: 'x',
      mediaInfoText: 'a [/code=x] [img]https://evil.example/p.png[/img] [/CODE] end',
    });
    const html = bbcodeToHtml(text);
    expect(html).not.toContain('<img');
    expect(html).toMatch(/<pre><code>[^<]*end<\/code><\/pre><\/details>$/);
  });

  it('gives an LFE channel only from 6 channels', () => {
    expect(channelLayout(1)).toBe('1.0');
    expect(channelLayout(3)).toBe('3.0');
    expect(channelLayout(5)).toBe('5.0');
    expect(channelLayout(6)).toBe('5.1');
  });
});
