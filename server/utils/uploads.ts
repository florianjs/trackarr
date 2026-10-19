import { readdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

/**
 * Uploaded images (logos, favicons, avatars) are stored in Postgres so every
 * node of a replicated deployment serves the same files: database replication
 * carries them to the other sites. The former disk directory is only read as
 * a fallback and imported at startup.
 */

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  gif: 'image/gif',
  ico: 'image/x-icon',
};

export function uploadMimeType(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? MIME_TYPES[ext] : undefined;
}

/**
 * Legacy uploads directory (before uploads moved to the database).
 * In production, use an absolute path since process.cwd() may differ after build.
 */
export function getUploadsDir(): string {
  return process.env.NODE_ENV === 'production'
    ? '/app/public/uploads'
    : join(process.cwd(), 'public', 'uploads');
}

export async function saveUpload(name: string, data: Buffer): Promise<void> {
  await db.insert(schema.uploads).values({
    name,
    contentType: uploadMimeType(name) ?? 'application/octet-stream',
    data,
  });
}

/** Database first, then the legacy directory. Callers must validate `name`. */
export async function readUpload(name: string): Promise<Buffer | null> {
  const row = await db.query.uploads.findFirst({
    where: eq(schema.uploads.name, name),
    columns: { data: true },
  });
  if (row) return row.data;
  try {
    return await readFile(join(getUploadsDir(), name));
  } catch {
    return null;
  }
}

/** Callers must validate `name`: it also reaches unlink on the legacy directory. */
export async function deleteUpload(name: string): Promise<void> {
  await db.delete(schema.uploads).where(eq(schema.uploads.name, name));
  try {
    await unlink(join(getUploadsDir(), name));
  } catch {
    // Not on disk
  }
}

/**
 * Copy files from the legacy directory into the database. Idempotent, and
 * safe to run from several nodes at once.
 */
export async function importDiskUploads(): Promise<number> {
  let names: string[];
  try {
    names = await readdir(getUploadsDir());
  } catch {
    return 0; // No legacy directory
  }
  let imported = 0;
  for (const name of names) {
    const contentType = uploadMimeType(name);
    if (!contentType) continue;
    const data = await readFile(join(getUploadsDir(), name));
    const rows = await db
      .insert(schema.uploads)
      .values({ name, contentType, data })
      .onConflictDoNothing()
      .returning({ name: schema.uploads.name });
    imported += rows.length;
  }
  return imported;
}

/**
 * Delete a previous avatar. Only names we generated are accepted, so a
 * crafted value can never point unlink outside the uploads directory.
 */
export async function removeAvatarFile(url: string | null | undefined) {
  const name = url?.startsWith('/uploads/') ? url.slice('/uploads/'.length) : null;
  if (!name || !/^avatar-[a-f0-9]{16}\.(png|jpg|gif|webp)$/.test(name)) return;
  // The new avatar is already saved: a leftover file must not fail the request
  await deleteUpload(name).catch((err) => {
    console.error('[Uploads] Failed to delete old avatar:', err);
  });
}
