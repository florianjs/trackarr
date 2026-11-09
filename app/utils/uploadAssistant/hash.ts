/**
 * Build the .torrent in the browser: files are read slice by slice and
 * hashed with WebCrypto, so a large release never sits in memory.
 */

import { buildTorrent, type BuiltTorrent } from '~~/shared/utils/release/torrent';
import type { PickedRelease } from './files';

const sha1 = async (data: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest('SHA-1', data as Uint8Array<ArrayBuffer>));

export function hashRelease(
  picked: PickedRelease,
  options: {
    announce: string;
    source: string;
    /** Aborting stops reading the files (the release was replaced) */
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<BuiltTorrent> {
  return buildTorrent({
    name: picked.name,
    folder: picked.folder,
    announce: options.announce,
    source: options.source,
    sha1,
    onProgress: options.onProgress,
    files: picked.files.map(({ file, path }) => ({
      path,
      length: file.size,
      read: async (offset, length) => {
        options.signal?.throwIfAborted();
        return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
      },
    })),
  });
}
