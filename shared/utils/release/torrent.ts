/**
 * .torrent creation shared by the web upload assistant (File.slice + WebCrypto)
 * and the CLI (fs + node:crypto). Always private, with the uploader's personal
 * announce URL: the tracker stores a copy without it and, the info dict being
 * unchanged, with the same info hash, so the uploader seeds this very file.
 */

import bencode from 'bencode';

export interface TorrentInputFile {
  /** Path inside the torrent, relative to its root folder: [file] or [dir, ..., file] */
  path: string[];
  length: number;
  /** Read `length` bytes at `offset` of this file */
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface BuildTorrentOptions {
  /** Torrent name: the file name (single file) or the folder name */
  name: string;
  /** Shared as a folder (multi-file torrent), even with a single file inside */
  folder?: boolean;
  files: TorrentInputFile[];
  announce: string;
  /** Stored in info.source: makes the hash unique to this tracker (cross-seeding) */
  source?: string;
  comment?: string;
  createdBy?: string;
  pieceLength?: number;
  sha1(data: Uint8Array): Promise<Uint8Array>;
  /** Hashed bytes so far, out of the total */
  onProgress?(done: number, total: number): void;
  /** Pieces hashed at once (WebCrypto is asynchronous) */
  concurrency?: number;
  /** Creation date in seconds (tests) */
  creationDate?: number;
}

export interface BuiltTorrent {
  torrent: Uint8Array;
  infoHash: string;
  pieceLength: number;
  totalSize: number;
}

const MIN_PIECE = 16 * 1024;
const MAX_PIECE = 16 * 1024 * 1024;
const TARGET_PIECES = 1500;

/** Power of two between 16 KiB and 16 MiB giving about 1500 pieces */
export function pickPieceLength(totalSize: number): number {
  let size = MIN_PIECE;
  while (size < MAX_PIECE && totalSize / size > TARGET_PIECES) size *= 2;
  return size;
}

/** Files nobody wants in a release */
export function isJunkFile(name: string): boolean {
  const base = name.toLowerCase();
  return (
    base === '.ds_store' ||
    base === 'thumbs.db' ||
    base === 'desktop.ini' ||
    base.startsWith('._') ||
    base.endsWith('.part') ||
    base.endsWith('.!qb') ||
    base.endsWith('.torrent')
  );
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read the files as one continuous stream cut into pieces (BitTorrent v1:
 * pieces cross file boundaries)
 */
async function readPiece(
  files: TorrentInputFile[],
  starts: number[],
  start: number,
  length: number
): Promise<Uint8Array> {
  const piece = new Uint8Array(length);
  let filled = 0;
  let i = starts.findIndex((s, idx) => start < s + files[idx]!.length);
  while (filled < length && i >= 0 && i < files.length) {
    const file = files[i]!;
    const offset = start + filled - starts[i]!;
    const take = Math.min(file.length - offset, length - filled);
    if (take > 0) {
      const chunk = await file.read(offset, take);
      if (chunk.length !== take) throw new Error(`Short read in ${file.path.join('/')}`);
      piece.set(chunk, filled);
      filled += take;
    }
    i++;
  }
  return piece;
}

export async function buildTorrent(options: BuildTorrentOptions): Promise<BuiltTorrent> {
  const files = options.files.filter((f) => f.length > 0);
  if (files.length === 0) throw new Error('Nothing to share: every file is empty');
  const totalSize = files.reduce((sum, f) => sum + f.length, 0);
  const pieceLength = options.pieceLength ?? pickPieceLength(totalSize);
  const pieceCount = Math.ceil(totalSize / pieceLength);
  const starts: number[] = [];
  files.reduce((offset, f) => (starts.push(offset), offset + f.length), 0);

  const hashes = new Uint8Array(pieceCount * 20);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < pieceCount) {
      const index = next++;
      const start = index * pieceLength;
      const length = Math.min(pieceLength, totalSize - start);
      const piece = await readPiece(files, starts, start, length);
      hashes.set(await options.sha1(piece), index * 20);
      done += length;
      options.onProgress?.(done, totalSize);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 4) }, worker));

  const single = !options.folder && files.length === 1;
  const info: Record<string, unknown> = {
    name: options.name,
    'piece length': pieceLength,
    pieces: hashes,
    private: 1,
    ...(options.source ? { source: options.source } : {}),
    ...(single
      ? { length: files[0]!.length }
      : { files: files.map((f) => ({ length: f.length, path: f.path })) }),
  };

  const torrent: Record<string, unknown> = {
    announce: options.announce,
    'created by': options.createdBy ?? 'Trackarr upload assistant',
    'creation date': options.creationDate ?? Math.floor(Date.now() / 1000),
    info,
    ...(options.comment ? { comment: options.comment } : {}),
  };

  const infoHash = toHex(await options.sha1(bencode.encode(info)));
  return { torrent: bencode.encode(torrent), infoHash, pieceLength, totalSize };
}
