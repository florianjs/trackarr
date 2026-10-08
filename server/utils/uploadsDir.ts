import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Persistent uploads directory (logos, favicons, avatars).
 * In production, use an absolute path since process.cwd() may differ after build.
 */
export function getUploadsDir(): string {
  return process.env.NODE_ENV === 'production'
    ? '/app/public/uploads'
    : join(process.cwd(), 'public', 'uploads');
}

/**
 * Delete a previous avatar file. Only names we generated are accepted, so a
 * crafted value can never point unlink outside the uploads directory.
 */
export async function removeAvatarFile(url: string | null | undefined) {
  const name = url?.startsWith('/uploads/') ? url.slice('/uploads/'.length) : null;
  if (!name || !/^avatar-[a-f0-9]{16}\.(png|jpg|gif|webp)$/.test(name)) return;
  try {
    await unlink(join(getUploadsDir(), name));
  } catch {
    // Already gone
  }
}
