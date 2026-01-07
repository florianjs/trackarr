import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../../db';
import {
  users,
  torrents,
  panicState,
  forumPosts,
  torrentComments,
} from '../../../db/schema';
import { deriveKey, decryptField, decrypt } from '../../../utils/panic';

/**
 * POST /api/admin/panic/restore
 * Restore encrypted database using panic password
 * This endpoint is publicly accessible (no auth required) since
 * user sessions may be invalid after encryption
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.panicPassword) {
    throw createError({
      statusCode: 400,
      message: 'Panic password is required',
    });
  }

  // Check if database is encrypted
  const currentState = await db.query.panicState.findFirst();
  if (!currentState?.isEncrypted) {
    throw createError({
      statusCode: 400,
      message: 'Database is not encrypted',
    });
  }

  if (!currentState.encryptionSalt || !currentState.encryptionIv) {
    throw createError({
      statusCode: 500,
      message: 'Encryption metadata missing. Recovery impossible.',
    });
  }

  // Get first admin to verify panic password
  const admin = await db.query.users.findFirst({
    where: and(eq(users.isAdmin, true)),
    orderBy: asc(users.createdAt),
  });

  if (!admin?.panicPasswordHash) {
    throw createError({
      statusCode: 500,
      message: 'Admin panic password hash not found',
    });
  }

  // Verify panic password matches stored hash
  const isValid = await verifyPassword(admin.panicPasswordHash, body.panicPassword);
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid panic password',
    });
  }

  // Derive decryption key (same as encryption key)
  const key = await deriveKey(
    admin.panicPasswordHash,
    Buffer.from(currentState.encryptionSalt, 'base64')
  );
  const ivBuffer = Buffer.from(currentState.encryptionIv, 'base64');

  // =====================================================================
  // Decrypt user data
  // =====================================================================
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    try {
      await db
        .update(users)
        .set({
          authSalt: decryptField(user.authSalt, key, ivBuffer),
          authVerifier: decryptField(user.authVerifier, key, ivBuffer),
          passkey: decryptField(user.passkey, key, ivBuffer)!,
          lastIp: decryptField(user.lastIp, key, ivBuffer) ?? undefined,
        })
        .where(eq(users.id, user.id));
    } catch (err) {
      console.error(`Failed to decrypt user ${user.id}:`, err);
    }
  }

  // =====================================================================
  // Decrypt torrent data (including .torrent file and metadata)
  // =====================================================================
  const allTorrents = await db.select().from(torrents);
  for (const torrent of allTorrents) {
    try {
      // Parse the description to extract encrypted metadata
      const panicMetaMatch = torrent.description?.match(
        /^\[PANIC_META:([^\]]+)\](.*)?$/s
      );

      let decryptedDesc: string | null = null;
      let originalSize: number = torrent.size;
      let originalCategoryId: string | null = torrent.categoryId;

      if (panicMetaMatch) {
        // Extract and decrypt metadata
        const encryptedMeta = panicMetaMatch[1]!;
        const encryptedDescPart = panicMetaMatch[2] || null;

        try {
          const metaJson = decrypt(encryptedMeta, key, ivBuffer);
          const meta = JSON.parse(metaJson);
          originalSize = meta.size ?? 0;
          originalCategoryId = meta.categoryId ?? null;
        } catch {
          console.error(`Failed to decrypt metadata for torrent ${torrent.id}`);
        }

        // Decrypt the description part (after the metadata prefix)
        decryptedDesc = encryptedDescPart
          ? decryptField(encryptedDescPart, key, ivBuffer)
          : null;
      } else {
        // Fallback: try to decrypt the whole description
        decryptedDesc = decryptField(torrent.description, key, ivBuffer);
      }

      // Decrypt the .torrent file (Buffer -> utf8 string -> decrypt -> base64 -> Buffer)
      let decryptedTorrentData: Buffer | null = null;
      if (torrent.torrentData) {
        try {
          const encryptedStr = torrent.torrentData.toString('utf8');
          const decryptedBase64 = decrypt(encryptedStr, key, ivBuffer);
          decryptedTorrentData = Buffer.from(decryptedBase64, 'base64');
        } catch {
          console.error(`Failed to decrypt torrentData for torrent ${torrent.id}`);
        }
      }

      await db
        .update(torrents)
        .set({
          name: decryptField(torrent.name, key, ivBuffer) ?? torrent.name,
          description: decryptedDesc,
          torrentData: decryptedTorrentData,
          size: originalSize,
          categoryId: originalCategoryId,
        })
        .where(eq(torrents.id, torrent.id));
    } catch (err) {
      console.error(`Failed to decrypt torrent ${torrent.id}:`, err);
    }
  }

  // =====================================================================
  // Decrypt forum posts
  // =====================================================================
  const allPosts = await db.select().from(forumPosts);
  for (const post of allPosts) {
    try {
      await db
        .update(forumPosts)
        .set({
          content: decryptField(post.content, key, ivBuffer) ?? post.content,
        })
        .where(eq(forumPosts.id, post.id));
    } catch (err) {
      console.error(`Failed to decrypt post ${post.id}:`, err);
    }
  }

  // =====================================================================
  // Decrypt torrent comments
  // =====================================================================
  const allComments = await db.select().from(torrentComments);
  for (const comment of allComments) {
    try {
      await db
        .update(torrentComments)
        .set({
          content: decryptField(comment.content, key, ivBuffer) ?? comment.content,
        })
        .where(eq(torrentComments.id, comment.id));
    } catch (err) {
      console.error(`Failed to decrypt comment ${comment.id}:`, err);
    }
  }

  // =====================================================================
  // Update panic state
  // =====================================================================
  await db
    .update(panicState)
    .set({
      isEncrypted: false,
      encryptedAt: null,
      encryptionSalt: null,
      encryptionIv: null,
    })
    .where(eq(panicState.id, 'singleton'));

  return {
    success: true,
    message: 'Database restored successfully',
  };
});
