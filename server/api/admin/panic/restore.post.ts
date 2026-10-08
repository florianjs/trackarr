import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import {
  users,
  torrents,
  panicState,
  forumPosts,
  torrentComments,
} from '../../../db/schema';
import { protectEndpoint } from '../../../utils/rateLimit';
import { deriveKey, decryptField, decrypt } from '../../../utils/panic';

const bodySchema = z.object({
  panicPassword: z.string().min(1).max(256),
});

/**
 * POST /api/admin/panic/restore
 * Restore encrypted database using panic password
 * This endpoint is publicly accessible (no auth required) since
 * user sessions may be invalid after encryption
 */
export default defineEventHandler(async (event) => {
  // Public endpoint: strict brute-force protection
  await protectEndpoint(event, 'auth');

  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Panic password is required',
    });
  }
  const { panicPassword } = parsed.data;

  // Check if database is encrypted
  const currentState = await db.query.panicState.findFirst();
  if (!currentState?.isEncrypted) {
    throw createError({
      statusCode: 400,
      message: 'Database is not encrypted',
    });
  }

  if (!currentState.encryptionSalt) {
    throw createError({
      statusCode: 500,
      message: 'Encryption metadata missing. Recovery impossible.',
    });
  }

  // Get first admin to verify panic password
  const admin = await db.query.users.findFirst({
    where: eq(users.isAdmin, true),
    orderBy: asc(users.createdAt),
  });

  if (!admin?.panicPasswordHash) {
    throw createError({
      statusCode: 500,
      message: 'Admin panic password hash not found',
    });
  }

  // Verify panic password matches stored hash
  const isValid = await verifyPassword(admin.panicPasswordHash, panicPassword);
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid panic password',
    });
  }

  // Legacy scheme (shared IV stored in panic_state, key derived from the
  // stored hash) is still decrypted so instances encrypted before the fix
  // can be restored.
  const legacyIv = currentState.encryptionIv
    ? Buffer.from(currentState.encryptionIv, 'base64')
    : undefined;
  const key = await deriveKey(
    legacyIv ? admin.panicPasswordHash : panicPassword,
    Buffer.from(currentState.encryptionSalt, 'base64')
  );

  // Single transaction: any decryption failure rolls everything back so the
  // data stays recoverable instead of being half restored.
  try {
    await db.transaction(async (tx) => {
      // ===================================================================
      // Decrypt user data
      // ===================================================================
      const allUsers = await tx.select().from(users);
      for (const user of allUsers) {
        await tx
          .update(users)
          .set({
            authSalt: decryptField(user.authSalt, key, legacyIv),
            authVerifier: decryptField(user.authVerifier, key, legacyIv),
            passkey: decryptField(user.passkey, key, legacyIv)!,
            lastIp: decryptField(user.lastIp, key, legacyIv) ?? undefined,
          })
          .where(eq(users.id, user.id));
      }

      // ===================================================================
      // Decrypt torrent data (including .torrent file and metadata)
      // ===================================================================
      const allTorrents = await tx.select().from(torrents);
      for (const torrent of allTorrents) {
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

          const meta = JSON.parse(decrypt(encryptedMeta, key, legacyIv));
          originalSize = meta.size ?? 0;
          originalCategoryId = meta.categoryId ?? null;

          // Decrypt the description part (after the metadata prefix)
          decryptedDesc = encryptedDescPart
            ? decryptField(encryptedDescPart, key, legacyIv)
            : null;
        } else {
          // Fallback: try to decrypt the whole description
          decryptedDesc = decryptField(torrent.description, key, legacyIv);
        }

        // Decrypt the .torrent file (Buffer -> utf8 string -> decrypt -> base64 -> Buffer)
        let decryptedTorrentData: Buffer | null = null;
        if (torrent.torrentData) {
          const encryptedStr = torrent.torrentData.toString('utf8');
          const decryptedBase64 = decrypt(encryptedStr, key, legacyIv);
          decryptedTorrentData = Buffer.from(decryptedBase64, 'base64');
        }

        await tx
          .update(torrents)
          .set({
            name: decryptField(torrent.name, key, legacyIv) ?? torrent.name,
            description: decryptedDesc,
            torrentData: decryptedTorrentData,
            size: originalSize,
            categoryId: originalCategoryId,
          })
          .where(eq(torrents.id, torrent.id));
      }

      // ===================================================================
      // Decrypt forum posts
      // ===================================================================
      const allPosts = await tx.select().from(forumPosts);
      for (const post of allPosts) {
        await tx
          .update(forumPosts)
          .set({
            content:
              decryptField(post.content, key, legacyIv) ?? post.content,
          })
          .where(eq(forumPosts.id, post.id));
      }

      // ===================================================================
      // Decrypt torrent comments
      // ===================================================================
      const allComments = await tx.select().from(torrentComments);
      for (const comment of allComments) {
        await tx
          .update(torrentComments)
          .set({
            content:
              decryptField(comment.content, key, legacyIv) ?? comment.content,
          })
          .where(eq(torrentComments.id, comment.id));
      }

      // ===================================================================
      // Update panic state
      // ===================================================================
      await tx
        .update(panicState)
        .set({
          isEncrypted: false,
          encryptedAt: null,
          encryptionSalt: null,
          encryptionIv: null,
        })
        .where(eq(panicState.id, 'singleton'));
    });
  } catch (err) {
    console.error('[Panic] Restore failed, transaction rolled back:', err);
    throw createError({
      statusCode: 500,
      message: 'Restore failed. Database left encrypted and unchanged.',
    });
  }

  return {
    success: true,
    message: 'Database restored successfully',
  };
});
