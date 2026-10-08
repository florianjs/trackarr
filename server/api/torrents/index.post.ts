import { db, schema } from '../../db';
import { randomUUID } from 'crypto';
import parseTorrent from 'parse-torrent';
import { z } from 'zod';
import { rateLimit, RATE_LIMITS } from '../../utils/rateLimit';
import { stripAnnounceUrls } from '../../utils/torrentFile';

// readMultipartFormData buffers the whole body: reject oversized requests first
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 10000;
const tagIdsSchema = z.array(z.uuid()).max(20);

export default defineEventHandler(async (event) => {
  // Require authentication
  const { user } = await requireAuthSession(event);

  // Rate limit uploads
  await rateLimit(event, RATE_LIMITS.mutation);

  const contentLength = Number(getHeader(event, 'content-length') || 0);
  if (!contentLength) {
    throw createError({ statusCode: 411, message: 'Content-Length required' });
  }
  if (contentLength > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, message: 'Upload too large (max 5MB)' });
  }

  // Read multipart form data
  const formData = await readMultipartFormData(event);

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file uploaded',
    });
  }

  const file = formData.find(
    (f) => f.name === 'torrent' || f.filename?.endsWith('.torrent')
  );
  const categoryId = formData
    .find((f) => f.name === 'categoryId')
    ?.data.toString();
  const description = formData
    .find((f) => f.name === 'description')
    ?.data.toString();
  const tagsRaw = formData.find((f) => f.name === 'tags')?.data.toString();

  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      message: 'No .torrent file found in request',
    });
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `Description too long (max ${MAX_DESCRIPTION_LENGTH} characters)`,
    });
  }

  if (categoryId && !z.uuid().safeParse(categoryId).success) {
    throw createError({ statusCode: 400, message: 'Invalid category' });
  }

  let tagIds: string[] = [];
  if (tagsRaw) {
    let raw: unknown;
    try {
      raw = JSON.parse(tagsRaw);
    } catch {
      raw = null;
    }
    const parsedTags = tagIdsSchema.safeParse(raw);
    if (!parsedTags.success) {
      throw createError({ statusCode: 400, message: 'Invalid tags' });
    }
    tagIds = parsedTags.data;
  }

  // Parse the torrent file
  let parsed: Awaited<ReturnType<typeof parseTorrent>>;
  try {
    parsed = await parseTorrent(file.data);
  } catch (_err) {
    throw createError({
      statusCode: 400,
      message: 'Invalid torrent file',
    });
  }

  if (!parsed.infoHash) {
    throw createError({
      statusCode: 400,
      message: 'Could not extract info hash from torrent',
    });
  }

  const infoHash = parsed.infoHash.toLowerCase();
  const name = parsed.name || file.filename || 'Unknown';

  // Calculate total size
  let totalSize = 0;
  if (parsed.length) {
    totalSize = parsed.length;
  } else if (parsed.files && Array.isArray(parsed.files)) {
    totalSize = parsed.files.reduce((sum, f) => sum + (f.length || 0), 0);
  }

  // Check if torrent already exists
  const existing = await db.query.torrents.findFirst({
    where: (t, { eq }) => eq(t.infoHash, infoHash),
    // Raw .torrent blob embeds the uploader's announce URL (passkey)
    columns: { torrentData: false },
  });

  if (existing) {
    // Return existing torrent
    return {
      success: true,
      message: 'Torrent already exists',
      data: {
        ...existing,
        magnetLink: generateMagnetLink(infoHash, name),
      },
    };
  }

  // Insert new torrent
  const id = randomUUID();
  const now = new Date();

  // Check if user can bypass moderation (admins, mods, or users with permission via role)
  // Need to fetch user's role to check permissions
  const userWithRole = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user.id),
    with: {
      role: true,
    },
  });

  const canBypassModeration =
    user.isAdmin ||
    user.isModerator ||
    (userWithRole?.role?.canUploadWithoutModeration ?? false);

  await db.insert(schema.torrents).values({
    id,
    infoHash,
    name,
    size: totalSize,
    description: description || null,
    torrentData: stripAnnounceUrls(file.data, infoHash),
    uploaderId: user.id, // Set uploader from authenticated user
    categoryId: categoryId || null,
    isActive: true,
    isApproved: canBypassModeration,
    createdAt: now,
  });

  // Initialize stats
  await db.insert(schema.torrentStats).values({
    infoHash,
    seeders: 0,
    leechers: 0,
    completed: 0,
    updatedAt: now,
  });

  // Add tags if provided (unknown tag ids are ignored)
  if (tagIds.length > 0) {
    try {
      await db.insert(schema.torrentTags).values(
        tagIds.map((tagId) => ({
          torrentId: id,
          tagId,
        }))
      );
    } catch {
      // Ignore tags that do not exist
    }
  }

  const torrent = {
    id,
    infoHash,
    name,
    size: totalSize,
    isActive: true,
    isApproved: canBypassModeration,
    createdAt: now.toISOString(),
    magnetLink: generateMagnetLink(infoHash, name),
  };

  return {
    success: true,
    message: canBypassModeration
      ? 'Torrent created successfully'
      : 'Torrent uploaded and pending moderation approval',
    data: torrent,
  };
});

function generateMagnetLink(infoHash: string, name: string): string {
  const trackerUrl =
    process.env.TRACKER_HTTP_URL || 'http://localhost:8080/announce';
  const encodedName = encodeURIComponent(name);
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodedName}&tr=${encodeURIComponent(trackerUrl)}`;
}
