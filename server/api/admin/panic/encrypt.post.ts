import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../../db';
import {
  users,
  torrents,
  panicState,
  forumPosts,
  torrentComments,
} from '../../../db/schema';
import { requireAdmin } from '../../../utils/auth';
import {
  deriveKey,
  generateSalt,
  generateIv,
  encryptField,
  encrypt,
} from '../../../utils/panic';

/**
 * POST /api/admin/panic/encrypt
 * Encrypt all sensitive database data
 * This is an emergency action that renders data unreadable
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);

  if (body.confirm !== 'ENCRYPT_ALL_DATA') {
    throw createError({
      statusCode: 400,
      message: 'Confirmation required. Send { confirm: "ENCRYPT_ALL_DATA" }',
    });
  }

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
    where: and(eq(users.isAdmin, true)),
    orderBy: asc(users.createdAt),
  });

  if (!admin?.panicPasswordHash) {
    throw createError({
      statusCode: 400,
      message: 'No panic password configured. Cannot encrypt.',
    });
  }

  // Generate encryption parameters
  const salt = generateSalt();
  const iv = generateIv();

  // Derive key from the original panic password (stored hash)
  // We use the hash as a "key" since we can't recover the original password
  const key = await deriveKey(admin.panicPasswordHash, Buffer.from(salt, 'base64'));
  const ivBuffer = Buffer.from(iv, 'base64');

  // =====================================================================
  // Encrypt sensitive user data
  // =====================================================================
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    await db
      .update(users)
      .set({
        authSalt: encryptField(user.authSalt, key, ivBuffer),
        authVerifier: encryptField(user.authVerifier, key, ivBuffer),
        passkey: encryptField(user.passkey, key, ivBuffer)!,
        lastIp: encryptField(user.lastIp, key, ivBuffer) ?? undefined,
      })
      .where(eq(users.id, user.id));
  }

  // =====================================================================
  // Encrypt torrent data (including .torrent file and metadata)
  // =====================================================================
  const allTorrents = await db.select().from(torrents);
  for (const torrent of allTorrents) {
    // Store original metadata for restoration (size, categoryId)
    const originalMeta = JSON.stringify({
      size: torrent.size,
      categoryId: torrent.categoryId,
    });
    const encryptedMeta = encrypt(originalMeta, key, ivBuffer);

    // Encrypt the .torrent file (Buffer -> base64 -> encrypt -> Buffer)
    let encryptedTorrentData: Buffer | null = null;
    if (torrent.torrentData) {
      const base64Data = torrent.torrentData.toString('base64');
      const encryptedBase64 = encrypt(base64Data, key, ivBuffer);
      encryptedTorrentData = Buffer.from(encryptedBase64, 'utf8');
    }

    // Build encrypted description with metadata prefix
    const encryptedDesc = encryptField(torrent.description, key, ivBuffer);
    const descWithMeta = `[PANIC_META:${encryptedMeta}]${encryptedDesc ?? ''}`;

    await db
      .update(torrents)
      .set({
        name: encryptField(torrent.name, key, ivBuffer) ?? '[ENCRYPTED]',
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
  const allPosts = await db.select().from(forumPosts);
  for (const post of allPosts) {
    await db
      .update(forumPosts)
      .set({
        content: encryptField(post.content, key, ivBuffer) ?? '[ENCRYPTED]',
      })
      .where(eq(forumPosts.id, post.id));
  }

  // =====================================================================
  // Encrypt torrent comments
  // =====================================================================
  const allComments = await db.select().from(torrentComments);
  for (const comment of allComments) {
    await db
      .update(torrentComments)
      .set({
        content: encryptField(comment.content, key, ivBuffer) ?? '[ENCRYPTED]',
      })
      .where(eq(torrentComments.id, comment.id));
  }

  // =====================================================================
  // Save panic state
  // =====================================================================
  await db
    .insert(panicState)
    .values({
      id: 'singleton',
      isEncrypted: true,
      encryptedAt: new Date(),
      encryptionSalt: salt,
      encryptionIv: iv,
    })
    .onConflictDoUpdate({
      target: panicState.id,
      set: {
        isEncrypted: true,
        encryptedAt: new Date(),
        encryptionSalt: salt,
        encryptionIv: iv,
      },
    });

  return {
    success: true,
    message: 'Database encrypted. Use panic password to restore.',
    encryptedAt: new Date().toISOString(),
  };
});
