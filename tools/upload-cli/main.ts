/**
 * trackarr-upload: the upload assistant from a terminal.
 *   node trackarr-upload.mjs <file-or-folder> --url https://tracker.example --key tk_...
 * Builds the private .torrent, reads MediaInfo, takes screenshots with ffmpeg,
 * hosts them on Pixhost, writes the BBCode description and publishes, using
 * the API key of the Integrations page. Bundled into a single file served by
 * the tracker at /tools/trackarr-upload.mjs (scripts/build-cli.mjs).
 * Needs Node.js 20+, ffmpeg and mediainfo in the PATH.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, readdir, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs, promisify } from 'node:util';
import { buildTorrent, isJunkFile } from '../../shared/utils/release/torrent';
import { cleanMediaInfoText, summarizeMediaInfo, type MediaSummary } from '../../shared/utils/release/mediainfo';
import { parseReleaseName, stripVideoExtension } from '../../shared/utils/release/releaseName';
import { buildDescription, formatSize, type Screenshot } from '../../shared/utils/release/description';
import { DESCRIPTION_LANGUAGES, isDescriptionLanguage } from '../../shared/utils/release/labels';
import { uploadToPixhost } from '../../server/utils/pixhost';

const run = promisify(execFile);
const CONFIG_FILE = join(homedir(), '.config', 'trackarr-upload.json');
const VIDEO = /\.(mkv|mp4|m4v|avi|mov|wmv|ts|m2ts|webm|mpg|mpeg)$/i;

const HELP = `Usage: node trackarr-upload.mjs <file-or-folder> [options]

Connection (or TRACKARR_URL / TRACKARR_API_KEY, or saved with --save)
  --url <url>            Tracker address, e.g. https://tracker.example
  --key <api key>        API key from the Integrations page (tk_...)
  --save                 Remember --url and --key in ${CONFIG_FILE}

Release
  --name <name>          Torrent name (default: the file or folder name)
  --title <title>        Title shown in the description
  --category <name|id>   Category, by name ("Movies", "Movies/HD") or id
  --tags <a,b>           Tags, by name
  --imdb <id> --tmdb <id> --tvdb <id>
  --notes <text>         Notes added to the description
  --lang <code>          Description language: ${DESCRIPTION_LANGUAGES.join(' ')} (default: en)
  --screens <n>          Screenshots (default: 6, 0 for none)
  --adult                Adult content: screenshots filed as NSFW on Pixhost

Output
  --out <dir>            Where to write the .torrent and the description (default: .)
  --dry-run              Build everything, publish nothing
  -y, --yes              Publish without asking
  -h, --help             Show this help`;

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const step = (message: string) => console.error(`• ${message}`);

interface SavedConfig {
  url?: string;
  key?: string;
}

async function loadSaved(): Promise<SavedConfig> {
  try {
    return JSON.parse(await readFile(CONFIG_FILE, 'utf8')) as SavedConfig;
  } catch {
    return {};
  }
}

async function has(command: string): Promise<boolean> {
  try {
    await run(command, ['-version'], { timeout: 10_000 });
    return true;
  } catch (err) {
    // mediainfo answers --version, ffmpeg -version
    if (command === 'mediainfo') {
      try {
        await run(command, ['--version'], { timeout: 10_000 });
        return true;
      } catch {
        return false;
      }
    }
    return (err as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

interface LocalFile {
  absolute: string;
  path: string[];
  size: number;
}

async function scan(root: string): Promise<{ name: string; folder: boolean; files: LocalFile[] }> {
  const info = await stat(root).catch(() => fail(`Not found: ${root}`));
  if (info.isFile()) {
    return { name: basename(root), folder: false, files: [{ absolute: root, path: [basename(root)], size: info.size }] };
  }
  const files: LocalFile[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (isJunkFile(entry.name)) continue;
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const size = (await stat(full)).size;
        if (size > 0) files.push({ absolute: full, path: relative(root, full).split(sep), size });
      }
    }
  };
  await walk(root);
  files.sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
  if (files.length === 0) fail('The folder holds no file to share');
  return { name: basename(resolve(root)), folder: true, files };
}

async function api<T>(base: string, key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(120_000),
  }).catch((err: Error) => fail(`Cannot reach ${base}: ${err.message}`));
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  if (!res.ok) fail(`${path}: ${body?.message ?? `HTTP ${res.status}`}`);
  return body as T;
}

async function screenshot(file: string, time: number, out: string, hdr: boolean): Promise<void> {
  const scale = "scale='min(1920,iw)':-2";
  // HDR to SDR, when ffmpeg has zimg; otherwise plain (washed-out colors)
  const tonemap =
    'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';
  const args = (vf: string) => ['-v', 'error', '-y', '-ss', time.toFixed(2), '-i', file, '-frames:v', '1', '-vf', vf, '-q:v', '3', out];
  if (hdr) {
    try {
      await run('ffmpeg', args(`${tonemap},${scale}`), { timeout: 120_000 });
      return;
    } catch {
      // No zimg in this build
    }
  }
  await run('ffmpeg', args(scale), { timeout: 120_000 });
}

let lastPct = -1;
function progressBar(done: number, total: number) {
  const pct = Math.floor((done / total) * 100);
  // Redraw once per percent, and only on a terminal (logs get one line)
  if (pct === lastPct || !process.stderr.isTTY) return;
  lastPct = pct;
  const width = 30;
  const filled = Math.round((pct / 100) * width);
  process.stderr.write(`\r  [${'#'.repeat(filled)}${'.'.repeat(width - filled)}] ${pct}%`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string' }, key: { type: 'string' }, save: { type: 'boolean' },
      name: { type: 'string' }, title: { type: 'string' }, category: { type: 'string' },
      tags: { type: 'string' }, imdb: { type: 'string' }, tmdb: { type: 'string' }, tvdb: { type: 'string' },
      notes: { type: 'string' }, lang: { type: 'string' }, screens: { type: 'string' },
      adult: { type: 'boolean' }, out: { type: 'string' }, 'dry-run': { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' }, help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const saved = await loadSaved();
  const base = (values.url ?? process.env.TRACKARR_URL ?? saved.url ?? '').replace(/\/+$/, '');
  const key = values.key ?? process.env.TRACKARR_API_KEY ?? saved.key ?? '';
  if (!/^https?:\/\//.test(base)) fail('Tracker address missing: --url https://tracker.example');
  if (!/^tk_[a-f0-9]{40}$/i.test(key)) fail('API key missing or malformed: --key tk_... (Integrations page)');
  if (values.save) {
    await mkdir(join(homedir(), '.config'), { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify({ url: base, key }, null, 2), { mode: 0o600 });
    step(`Saved the address and key in ${CONFIG_FILE}`);
  }
  const lang = values.lang ?? 'en';
  if (!isDescriptionLanguage(lang)) fail(`Unknown language "${lang}": ${DESCRIPTION_LANGUAGES.join(', ')}`);
  const count = values.screens === undefined ? 6 : Number(values.screens);
  if (!Number.isInteger(count) || count < 0 || count > 12) fail('--screens takes 0 to 12');

  const config = await api<{
    siteName: string;
    announceUrl: string;
    source: string;
    categories: { id: string; name: string; parentId: string | null }[];
    tags: { id: string; name: string }[];
  }>(base, key, '/api/upload-assistant/config');
  step(`Connected to ${config.siteName}`);

  // Category and tags by name
  let categoryId: string | undefined;
  if (values.category) {
    const wanted = values.category.toLowerCase();
    const byId = new Map(config.categories.map((c) => [c.id, c]));
    const full = (c: { name: string; parentId: string | null }) =>
      (c.parentId ? `${byId.get(c.parentId)?.name ?? ''}/${c.name}` : c.name).toLowerCase();
    const match = config.categories.find((c) => c.id === values.category || full(c) === wanted || c.name.toLowerCase() === wanted);
    if (!match) fail(`Unknown category "${values.category}". Known: ${config.categories.map((c) => full(c)).join(', ')}`);
    categoryId = match.id;
  }
  const tagIds = (values.tags ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((name) => config.tags.find((t) => t.name.toLowerCase() === name)?.id ?? fail(`Unknown tag "${name}"`));

  const release = await scan(resolve(positionals[0]!));
  const totalSize = release.files.reduce((s, f) => s + f.size, 0);
  step(`${release.name}: ${release.files.length} file(s), ${formatSize(totalSize, lang)}`);

  // MediaInfo and screenshots of the largest video
  const video = release.files.filter((f) => VIDEO.test(f.absolute)).sort((a, b) => b.size - a.size)[0];
  let summary: MediaSummary | null = null;
  let mediaInfoText: string | null = null;
  const screenshots: Screenshot[] = [];
  if (video) {
    if (await has('mediainfo')) {
      step('Reading MediaInfo');
      const [json, text] = await Promise.all([
        run('mediainfo', ['--Output=JSON', video.absolute], { maxBuffer: 64 * 1024 * 1024 }),
        run('mediainfo', [video.absolute], { maxBuffer: 64 * 1024 * 1024 }),
      ]);
      summary = summarizeMediaInfo(json.stdout);
      mediaInfoText = cleanMediaInfoText(text.stdout);
    } else {
      step('mediainfo not found: no MediaInfo report (install it for a full description)');
    }

    // Without mediainfo, ffprobe (shipped with ffmpeg) still gives the duration
    let duration = summary?.duration ?? null;
    if (!duration && count > 0) {
      try {
        const probe = await run('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', video.absolute,
        ]);
        duration = Number(probe.stdout.trim()) || null;
      } catch {
        duration = null;
      }
    }

    if (count > 0 && duration) {
      if (!(await has('ffmpeg'))) {
        step('ffmpeg not found: no screenshots');
      } else {
        const dir = await mkdtemp(join(tmpdir(), 'trackarr-'));
        try {
          const hdr = Boolean(summary?.video[0]?.hdr);
          for (let i = 0; i < count; i++) {
            const time = duration * 0.08 + (duration * 0.84 * (i + 0.5)) / count;
            const out = join(dir, `shot${i}.jpg`);
            process.stderr.write(
              process.stderr.isTTY ? `\r• Screenshot ${i + 1}/${count}` : `• Screenshot ${i + 1}/${count}\n`
            );
            await screenshot(video.absolute, time, out, hdr);
            screenshots.push(await uploadToPixhost(await readFile(out), `shot${i}.jpg`, Boolean(values.adult)));
          }
          process.stderr.write('\n');
        } catch (err) {
          process.stderr.write('\n');
          step(`Screenshots stopped: ${(err as Error).message}`);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    }
  }

  step('Building the .torrent');
  const handles = await Promise.all(release.files.map((f) => open(f.absolute, 'r')));
  let built;
  try {
    built = await buildTorrent({
      name: release.name,
      folder: release.folder,
      announce: config.announceUrl,
      source: config.source,
      sha1: async (data) => new Uint8Array(createHash('sha1').update(data).digest()),
      onProgress: progressBar,
      files: release.files.map((f, i) => ({
        path: f.path,
        length: f.size,
        read: async (offset, length) => {
          const buffer = new Uint8Array(length);
          let read = 0;
          while (read < length) {
            const { bytesRead } = await handles[i]!.read(buffer, read, length - read, offset + read);
            if (bytesRead === 0) break;
            read += bytesRead;
          }
          return buffer.subarray(0, read);
        },
      })),
    });
  } finally {
    process.stderr.write('\n');
    await Promise.all(handles.map((h) => h.close()));
  }

  const name = values.name ?? (release.folder ? release.name : stripVideoExtension(release.name));
  const parsed = parseReleaseName(release.name);
  const description = buildDescription({
    lang,
    title: values.title ?? parsed.title,
    release: parsed,
    summary,
    mediaInfoText,
    screenshots,
    files: release.folder ? release.files.map((f) => ({ path: f.path.join('/'), size: f.size })) : [],
    notes: values.notes,
  });

  const outDir = resolve(values.out ?? '.');
  await mkdir(outDir, { recursive: true });
  const safe = name.replace(/[\\/:*?"<>|]+/g, '_');
  const torrentPath = join(outDir, `${safe}.torrent`);
  await writeFile(torrentPath, built.torrent);
  await writeFile(join(outDir, `${safe}.bbcode.txt`), description);
  step(`Written: ${torrentPath} (+ .bbcode.txt), info hash ${built.infoHash}`);

  if (values['dry-run']) {
    step('Dry run: nothing published');
    return;
  }
  if (!values.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await rl.question(`Publish "${name}" on ${config.siteName}? [Y/n] `);
    rl.close();
    if (/^n/i.test(answer.trim())) return step('Not published');
  }

  const form = new FormData();
  form.append('torrent', new Blob([built.torrent as Uint8Array<ArrayBuffer>]), `${safe}.torrent`);
  form.append('name', name);
  form.append('description', description);
  if (categoryId) form.append('categoryId', categoryId);
  if (tagIds.length) form.append('tags', JSON.stringify(tagIds));
  if (values.imdb) form.append('imdbId', values.imdb);
  if (values.tmdb) form.append('tmdbId', values.tmdb);
  if (values.tvdb) form.append('tvdbId', values.tvdb);
  const result = await api<{ message?: string; data: { infoHash: string } }>(base, key, '/api/torrents', {
    method: 'POST',
    body: form,
  });
  console.log(`\n✓ ${result.message === 'Torrent already exists' ? 'Already on the tracker' : 'Published'}: ${base}/torrents/${result.data.infoHash}`);
  console.log(`  Seed it: add ${torrentPath} to your client, saving to ${resolve(positionals[0]!, '..')}`);
}

main().catch((err: Error) => fail(err.message));
