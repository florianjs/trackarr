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
import { protectEndpoint } from '../../../utils/rateLimit';
import {
  deriveKey,
  decryptField,
  decryptOrKeep,
  decrypt,
} from '../../../utils/panic';
import { invalidateBannedIps } from '../../../utils/bannedIps';
import { invalidateTrackerTorrents, invalidateTrackerUsers } from '../../../tracker/client';

const bodySchema = z.object({
  panicPassword: z.string().min(1).max(256),
});

/** Torrent columns hidden in the description prefix (media ids added later) */
interface PanicTorrentMeta {
  size?: number;
  categoryId?: string | null;
  imdbId?: string | null;
  tmdbId?: number | null;
  tvdbId?: number | null;
}

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
      // Kept as is when not ciphertext: accounts registered and IPs recorded
      // while encrypted are in clear
      const allUsers = await tx.select().from(users);
      for (const user of allUsers) {
        await tx
          .update(users)
          .set({
            authSalt: decryptOrKeep(user.authSalt, key, legacyIv),
            authVerifier: decryptOrKeep(user.authVerifier, key, legacyIv),
            passkey: decryptOrKeep(user.passkey, key, legacyIv)!,
            lastIp: decryptOrKeep(user.lastIp, key, legacyIv) ?? undefined,
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
        // Absent from metadata saved by older versions, which left them in place
        let originalImdbId: string | null = torrent.imdbId;
        let originalTmdbId: number | null = torrent.tmdbId;
        let originalTvdbId: number | null = torrent.tvdbId;

        if (panicMetaMatch) {
          // Extract and decrypt metadata
          const encryptedMeta = panicMetaMatch[1]!;
          const encryptedDescPart = panicMetaMatch[2] || null;

          const meta: PanicTorrentMeta = JSON.parse(
            decrypt(encryptedMeta, key, legacyIv)
          );
          originalSize = meta.size ?? 0;
          originalCategoryId = meta.categoryId ?? null;
          if ('imdbId' in meta) originalImdbId = meta.imdbId ?? null;
          if ('tmdbId' in meta) originalTmdbId = meta.tmdbId ?? null;
          if ('tvdbId' in meta) originalTvdbId = meta.tvdbId ?? null;

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
            imdbId: originalImdbId,
            tmdbId: originalTmdbId,
            tvdbId: originalTvdbId,
          })
          .where(eq(torrents.id, torrent.id));
      }

      // ===================================================================
      // Content below may be in clear: left so by older versions, or written
      // while encrypted (sessions stay valid). Plaintext is kept, not an error.
      // ===================================================================

      // ===================================================================
      // Decrypt forum topic titles
      // ===================================================================
      const allTopics = await tx.select().from(forumTopics);
      for (const topic of allTopics) {
        await tx
          .update(forumTopics)
          .set({
            title: decryptOrKeep(topic.title, key, legacyIv) ?? topic.title,
          })
          .where(eq(forumTopics.id, topic.id));
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
              decryptOrKeep(post.content, key, legacyIv) ?? post.content,
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
              decryptOrKeep(comment.content, key, legacyIv) ?? comment.content,
          })
          .where(eq(torrentComments.id, comment.id));
      }

      // ===================================================================
      // Decrypt private messages and shoutbox messages
      // ===================================================================
      const allMessages = await tx.select().from(privateMessages);
      for (const message of allMessages) {
        await tx
          .update(privateMessages)
          .set({
            body: decryptOrKeep(message.body, key, legacyIv) ?? message.body,
          })
          .where(eq(privateMessages.id, message.id));
      }

      const allShouts = await tx.select().from(shoutMessages);
      for (const shout of allShouts) {
        await tx
          .update(shoutMessages)
          .set({ body: decryptOrKeep(shout.body, key, legacyIv) ?? shout.body })
          .where(eq(shoutMessages.id, shout.id));
      }

      // ===================================================================
      // Decrypt banned IPs. Rewritten rather than updated: a ban added while
      // encrypted (from a user's encrypted last IP) may decrypt to an IP
      // already banned, which would break the primary key.
      // ===================================================================
      const allBans = await tx.select().from(bannedIps);
      await tx.delete(bannedIps);
      // Chunked: one insert is capped at 65535 bound parameters
      for (let i = 0; i < allBans.length; i += 1000) {
        await tx
          .insert(bannedIps)
          .values(
            allBans.slice(i, i + 1000).map((ban) => ({
              ip: decryptOrKeep(ban.ip, key, legacyIv) ?? ban.ip,
              reason: decryptOrKeep(ban.reason, key, legacyIv),
              createdAt: ban.createdAt,
            }))
          )
          .onConflictDoNothing();
      }

      // ===================================================================
      // Decrypt reports, bounties and the bonus ledger
      // ===================================================================
      const allReports = await tx.select().from(reports);
      for (const report of allReports) {
        await tx
          .update(reports)
          .set({
            reason: decryptOrKeep(report.reason, key, legacyIv) ?? report.reason,
            details: decryptOrKeep(report.details, key, legacyIv),
            resolution: decryptOrKeep(report.resolution, key, legacyIv),
          })
          .where(eq(reports.id, report.id));
      }

      const allBounties = await tx.select().from(bounties);
      for (const bounty of allBounties) {
        await tx
          .update(bounties)
          .set({
            title: decryptOrKeep(bounty.title, key, legacyIv) ?? bounty.title,
            description: decryptOrKeep(bounty.description, key, legacyIv),
            imdbId: decryptOrKeep(bounty.imdbId, key, legacyIv),
          })
          .where(eq(bounties.id, bounty.id));
      }

      const allTransactions = await tx.select().from(bonusTransactions);
      for (const transaction of allTransactions) {
        await tx
          .update(bonusTransactions)
          .set({
            description: decryptOrKeep(transaction.description, key, legacyIv),
          })
          .where(eq(bonusTransactions.id, transaction.id));
      }

      const allAdjustments = await tx.select().from(statAdjustments);
      for (const adjustment of allAdjustments) {
        await tx
          .update(statAdjustments)
          .set({ reason: decryptOrKeep(adjustment.reason, key, legacyIv)! })
          .where(eq(statAdjustments.id, adjustment.id));
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

  // Passkeys and torrents changed: drop tracker caches
  invalidateTrackerUsers();
  invalidateTrackerTorrents();
  invalidateBannedIps();

  return {
    success: true,
    message: 'Database restored successfully',
  };
});
