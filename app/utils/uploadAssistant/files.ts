/**
 * Files picked for a release: from an <input> (file or webkitdirectory) or a
 * drag and drop of files and folders. Junk files are left out.
 */

import { isJunkFile } from '~~/shared/utils/release/torrent';

export interface PickedFile {
  file: File;
  /** Path relative to the release root folder ([name] for a single file) */
  path: string[];
}

export interface PickedRelease {
  /** File name, or the folder name */
  name: string;
  folder: boolean;
  files: PickedFile[];
  totalSize: number;
}

const VIDEO = /\.(mkv|mp4|m4v|avi|mov|wmv|ts|m2ts|webm|mpg|mpeg)$/i;

export function isVideoName(name: string): boolean {
  return VIDEO.test(name);
}

function release(entries: { file: File; parts: string[] }[]): PickedRelease | null {
  const kept = entries.filter((e) => !e.parts.some(isJunkFile) && e.file.size > 0);
  if (kept.length === 0) return null;
  const roots = new Set(kept.map((e) => (e.parts.length > 1 ? e.parts[0] : '')));
  const folder = kept.length > 1 || kept[0]!.parts.length > 1;
  // One top-level folder: it becomes the torrent root
  const singleRoot = roots.size === 1 && !roots.has('');
  const name = folder ? (singleRoot ? [...roots][0]! : 'Release') : kept[0]!.file.name;
  const files = kept
    .map((e) => ({ file: e.file, path: folder && singleRoot ? e.parts.slice(1) : e.parts }))
    .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
  return { name, folder, files, totalSize: files.reduce((s, f) => s + f.file.size, 0) };
}

/** From <input type="file"> (multiple or webkitdirectory) */
export function releaseFromFileList(list: FileList | File[]): PickedRelease | null {
  return release(
    Array.from(list, (file) => ({
      file,
      parts: (file.webkitRelativePath || file.name).split('/').filter(Boolean),
    }))
  );
}

async function readEntry(entry: FileSystemEntry, prefix: string[]): Promise<{ file: File; parts: string[] }[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    return [{ file, parts: [...prefix, entry.name] }];
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  // readEntries returns batches until an empty one
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map((c) => readEntry(c, [...prefix, entry.name])));
  return nested.flat();
}

/** From a drop: files and whole folders */
export async function releaseFromDrop(transfer: DataTransfer): Promise<PickedRelease | null> {
  const entries = Array.from(transfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));
  if (entries.length === 0) return releaseFromFileList(transfer.files);
  const all = await Promise.all(entries.map((e) => readEntry(e, [])));
  return release(all.flat());
}

/** The file the screenshots and MediaInfo come from: the largest video */
export function mainVideo(picked: PickedRelease): File | null {
  return (
    picked.files
      .filter((f) => isVideoName(f.file.name))
      .sort((a, b) => b.file.size - a.file.size)[0]?.file ?? null
  );
}
