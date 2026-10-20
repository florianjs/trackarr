import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import {
  users,
  torrents,
  panicState,
  forumPosts,
  forumTopics,
  torrentComments,
  bannedIps,
  privateMessages,
  shoutMessages,
  reports,
  bonusTransactions,
  statAdjustments,
  bounties,
} from '../../../db/schema';
import { requireAdminSession } from '../../../utils/adminAuth';
import { protectEndpoint } from '../../../utils/rateLimit';
import {
  deriveKey,
  generateSalt,
  encryptField,
  encrypt,
} from '../../../utils/panic';
import { purgePanicRedisData } from '../../../utils/panicPurge';
import { invalidateBannedIps } from '../../../utils/bannedIps';
import { invalidateTrackerTorrents, invalidateTrackerUsers } from '../../../tracker/client';

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
          apiKey: encryptField(user.apiKey, key),
          lastIp: encryptField(user.lastIp, key) ?? undefined,
        })
        .where(eq(users.id, user.id));
    }

    // =====================================================================
    // Encrypt torrent data (including .torrent file and metadata)
    // =====================================================================
    const allTorrents = await tx.select().from(torrents);
    for (const torrent of allTorrents) {
      // Store original metadata for restoration (size, categoryId, and the
      // media ids, which would name the content as well as the title)
      const originalMeta = JSON.stringify({
        size: torrent.size,
        categoryId: torrent.categoryId,
        imdbId: torrent.imdbId,
        tmdbId: torrent.tmdbId,
        tvdbId: torrent.tvdbId,
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
          imdbId: null,
          tmdbId: null,
          tvdbId: null,
        })
        .where(eq(torrents.id, torrent.id));
    }

    // =====================================================================
    // Encrypt forum topic titles
    // =====================================================================
    const allTopics = await tx.select().from(forumTopics);
    for (const topic of allTopics) {
      await tx
        .update(forumTopics)
        .set({ title: encryptField(topic.title, key) ?? '[ENCRYPTED]' })
        .where(eq(forumTopics.id, topic.id));
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
    // Encrypt private messages and shoutbox messages
    // =====================================================================
    const allMessages = await tx.select().from(privateMessages);
    for (const message of allMessages) {
      await tx
        .update(privateMessages)
        .set({ body: encryptField(message.body, key) ?? '[ENCRYPTED]' })
        .where(eq(privateMessages.id, message.id));
    }

    const allShouts = await tx.select().from(shoutMessages);
    for (const shout of allShouts) {
      await tx
        .update(shoutMessages)
        .set({ body: encryptField(shout.body, key) ?? '[ENCRYPTED]' })
        .where(eq(shoutMessages.id, shout.id));
    }

    // =====================================================================
    // Encrypt banned IPs. The ban check compares IPs in clear, so bans are
    // inactive until restore: accepted, nobody can log in or announce
    // meanwhile (verifiers and passkeys are encrypted).
    // =====================================================================
    const allBans = await tx.select().from(bannedIps);
    for (const ban of allBans) {
      await tx
        .update(bannedIps)
        .set({
          ip: encryptField(ban.ip, key)!,
          reason: encryptField(ban.reason, key),
        })
        .where(eq(bannedIps.ip, ban.ip));
    }

    // =====================================================================
    // Encrypt reports, bounties and the bonus ledger (descriptions hold
    // torrent names and bounty titles)
    // =====================================================================
    const allReports = await tx.select().from(reports);
    for (const report of allReports) {
      await tx
        .update(reports)
        .set({
          reason: encryptField(report.reason, key) ?? '[ENCRYPTED]',
          details: encryptField(report.details, key),
          resolution: encryptField(report.resolution, key),
        })
        .where(eq(reports.id, report.id));
    }

    const allBounties = await tx.select().from(bounties);
    for (const bounty of allBounties) {
      await tx
        .update(bounties)
        .set({
          title: encryptField(bounty.title, key) ?? '[ENCRYPTED]',
          description: encryptField(bounty.description, key),
          imdbId: encryptField(bounty.imdbId, key),
        })
        .where(eq(bounties.id, bounty.id));
    }

    const allTransactions = await tx.select().from(bonusTransactions);
    for (const transaction of allTransactions) {
      await tx
        .update(bonusTransactions)
        .set({ description: encryptField(transaction.description, key) })
        .where(eq(bonusTransactions.id, transaction.id));
    }

    const allAdjustments = await tx.select().from(statAdjustments);
    for (const adjustment of allAdjustments) {
      await tx
        .update(statAdjustments)
        .set({ reason: encryptField(adjustment.reason, key)! })
        .where(eq(statAdjustments.id, adjustment.id));
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

  // Passkeys and torrents changed: drop tracker caches
  invalidateTrackerUsers();
  invalidateTrackerTorrents();
  invalidateBannedIps();

  // After the commit: logs keyed by passkey or holding IPs are deleted, not
  // encrypted. A Redis failure must not hide that the database is encrypted.
  try {
    await purgePanicRedisData();
  } catch (err) {
    console.error('[Panic] Redis logs not purged:', err);
  }

  return {
    success: true,
    message: 'Database encrypted. Use panic password to restore.',
    encryptedAt: new Date().toISOString(),
  };
});
