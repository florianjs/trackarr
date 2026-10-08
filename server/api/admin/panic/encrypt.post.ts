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
import { requireAdminSession } from '../../../utils/adminAuth';
import { protectEndpoint } from '../../../utils/rateLimit';
import {
  deriveKey,
  generateSalt,
  encryptField,
  encrypt,
} from '../../../utils/panic';

const bodySchema = z.object({
  confirm: z.literal('ENCRYPT_ALL_DATA'),
  panicPassword: z.string().min(1).max(256),
});

/**
 * POST /api/admin/panic/encrypt
 * Encrypt all sensitive database data
 * This is an emergency action that renders data unreadable
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  await protectEndpoint(event, 'auth');

  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message:
        'Confirmation required. Send { confirm: "ENCRYPT_ALL_DATA", panicPassword }',
    });
  }
  const { panicPassword } = parsed.data;

  // Check if already encrypted
  const currentState = await db.query.panicState.findFirst();
  if (currentState?.isEncrypted) {
    throw createError({
      statusCode: 400,
      message: 'Database is already encrypted',
    });
  }

  // Get first admin with panic password hash
  const admin = await db.query.users.findFirst({
    where: eq(users.isAdmin, true),
    orderBy: asc(users.createdAt),
  });

  if (!admin?.panicPasswordHash) {
    throw createError({
      statusCode: 400,
      message: 'No panic password configured. Cannot encrypt.',
    });
  }

  // The key must come from the password itself: the stored hash is readable
  // by anyone holding the database, so deriving from it would protect nothing.
  const isValid = await verifyPassword(admin.panicPasswordHash, panicPassword);
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid panic password',
    });
  }

  const salt = generateSalt();
  const key = await deriveKey(panicPassword, Buffer.from(salt, 'base64'));

  // Single transaction: a crash halfway must not leave the DB half encrypted
  // without the salt saved.
  await db.transaction(async (tx) => {
    // =====================================================================
    // Encrypt sensitive user data
    // =====================================================================
    const allUsers = await tx.select().from(users);
    for (const user of allUsers) {
      await tx
        .update(users)
        .set({
          authSalt: encryptField(user.authSalt, key),
          authVerifier: encryptField(user.authVerifier, key),
          passkey: encryptField(user.passkey, key)!,
          lastIp: encryptField(user.lastIp, key) ?? undefined,
        })
        .where(eq(users.id, user.id));
    }

    // =====================================================================
    // Encrypt torrent data (including .torrent file and metadata)
    // =====================================================================
    const allTorrents = await tx.select().from(torrents);
    for (const torrent of allTorrents) {
      // Store original metadata for restoration (size, categoryId)
      const originalMeta = JSON.stringify({
        size: torrent.size,
        categoryId: torrent.categoryId,
      });
      const encryptedMeta = encrypt(originalMeta, key);

      // Encrypt the .torrent file (Buffer -> base64 -> encrypt -> Buffer)
      let encryptedTorrentData: Buffer | null = null;
      if (torrent.torrentData) {
        const base64Data = torrent.torrentData.toString('base64');
        const encryptedBase64 = encrypt(base64Data, key);
        encryptedTorrentData = Buffer.from(encryptedBase64, 'utf8');
      }

      // Build encrypted description with metadata prefix
      const encryptedDesc = encryptField(torrent.description, key);
      const descWithMeta = `[PANIC_META:${encryptedMeta}]${encryptedDesc ?? ''}`;

      await tx
        .update(torrents)
        .set({
          name: encryptField(torrent.name, key) ?? '[ENCRYPTED]',
          description: descWithMeta,
          torrentData: encryptedTorrentData,
          size: 0, // Hide real size
          categoryId: null, // Clear category reference
        })
        .where(eq(torrents.id, torrent.id));
    }

    // =====================================================================
    // Encrypt forum posts
    // =====================================================================
    const allPosts = await tx.select().from(forumPosts);
    for (const post of allPosts) {
      await tx
        .update(forumPosts)
        .set({
          content: encryptField(post.content, key) ?? '[ENCRYPTED]',
        })
        .where(eq(forumPosts.id, post.id));
    }

    // =====================================================================
    // Encrypt torrent comments
    // =====================================================================
    const allComments = await tx.select().from(torrentComments);
    for (const comment of allComments) {
      await tx
        .update(torrentComments)
        .set({
          content: encryptField(comment.content, key) ?? '[ENCRYPTED]',
        })
        .where(eq(torrentComments.id, comment.id));
    }

    // =====================================================================
    // Save panic state
    // encryptionIv stays null: each value carries its own IV (iv:ct:tag).
    // A non-null IV marks data encrypted by the legacy shared-IV scheme.
    // =====================================================================
    await tx
      .insert(panicState)
      .values({
        id: 'singleton',
        isEncrypted: true,
        encryptedAt: new Date(),
        encryptionSalt: salt,
        encryptionIv: null,
      })
      .onConflictDoUpdate({
        target: panicState.id,
        set: {
          isEncrypted: true,
          encryptedAt: new Date(),
          encryptionSalt: salt,
          encryptionIv: null,
        },
      });
  });

  return {
    success: true,
    message: 'Database encrypted. Use panic password to restore.',
    encryptedAt: new Date().toISOString(),
  };
});
