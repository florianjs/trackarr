/**
 * Shoutbox: access checks, channel versions and message loading.
 * Access rules themselves live in shoutboxRules.ts (unit tested).
 */

import type { H3Event } from 'h3';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { db, schema } from '../db';
import { redis } from '../redis/client';
import { SETTINGS_KEYS, getSetting, isShoutboxEnabled, setSetting } from './settings';
import { validateParam, uuidSchema } from './schemas';
import {
  canDeleteShout,
  canReactChannel,
  canReadChannel,
  canWriteChannel,
  isStaff,
  summarizeReactions,
  type ShoutViewer,
} from './shoutboxRules';

export const SHOUT_PAGE_SIZE = 50;

/** Disabled shoutbox: members get a 404, as if it did not exist */
export async function requireShoutboxEnabled(): Promise<void> {
  if (!(await isShoutboxEnabled())) {
    throw createError({ statusCode: 404, message: 'Shoutbox is disabled' });
  }
}

/** Enabled shoutbox + signed-in member, with the role used by channel access */
export async function requireShoutViewer(event: H3Event): Promise<ShoutViewer> {
  await requireShoutboxEnabled();
  const { user } = await requireAuthSession(event);
  const account = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { roleId: true },
  });
  return {
    id: user.id,
    isAdmin: user.isAdmin,
    isModerator: user.isModerator,
    roleId: account?.roleId ?? null,
  };
}

const DEFAULT_CHANNELS = [
  { slug: 'general', name: 'Général', position: 0, writeAccess: 'members' },
  { slug: 'announcements', name: 'Annonces', position: 1, writeAccess: 'admins' },
] as const;

/**
 * First use: create the general and announcements channels. Done once, so
 * channels an admin deleted do not come back.
 */
export async function ensureDefaultChannels(): Promise<void> {
  if ((await getSetting(SETTINGS_KEYS.SHOUTBOX_SEEDED)) === 'true') return;
  // Slugs are unique: nodes seeding at once insert each channel only once
  await db
    .insert(schema.shoutChannels)
    .values(DEFAULT_CHANNELS.map((c) => ({ id: randomUUID(), ...c })))
    .onConflictDoNothing();
  await setSetting(SETTINGS_KEYS.SHOUTBOX_SEEDED, 'true');
}

/** Channel from the :id param the viewer can read, or 404 */
export async function requireReadableChannel(event: H3Event, viewer: ShoutViewer, param = 'id') {
  const channelId = validateParam(event, param, uuidSchema);
  const channel = await db.query.shoutChannels.findFirst({
    where: eq(schema.shoutChannels.id, channelId),
  });
  if (!channel || !canReadChannel(channel, viewer)) {
    throw createError({ statusCode: 404, message: 'Channel not found' });
  }
  return channel;
}

/** Message from the :id param, with its channel, if the viewer can read it */
export async function requireReadableMessage(event: H3Event, viewer: ShoutViewer) {
  const messageId = validateParam(event, 'id', uuidSchema);
  const [row] = await db
    .select({ message: schema.shoutMessages, channel: schema.shoutChannels })
    .from(schema.shoutMessages)
    .innerJoin(schema.shoutChannels, eq(schema.shoutChannels.id, schema.shoutMessages.channelId))
    .where(eq(schema.shoutMessages.id, messageId))
    .limit(1);
  if (!row || !canReadChannel(row.channel, viewer)) {
    throw createError({ statusCode: 404, message: 'Message not found' });
  }
  return row;
}

// ----------------------------------------------------------------------------
// Channel versions: clients poll with the version they hold and get an empty
// answer while nothing changed. Kept in Redis so every app node agrees.
// A random value (not a counter) so a Redis restart never repeats a version.
// ----------------------------------------------------------------------------

const versionKey = (channelId: string) => `shout:ver:${channelId}`;

export async function bumpChannelVersion(channelId: string): Promise<void> {
  await redis.set(versionKey(channelId), randomUUID().slice(0, 8)).catch(() => {});
}

/** Current version, or null when Redis cannot tell (clients then reload) */
export async function getChannelVersion(channelId: string): Promise<string | null> {
  try {
    const version = await redis.get(versionKey(channelId));
    if (version) return version;
    const fresh = randomUUID().slice(0, 8);
    // NX: two nodes initializing at once agree on one value
    await redis.set(versionKey(channelId), fresh, 'NX');
    return (await redis.get(versionKey(channelId))) ?? fresh;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Mutes
// ----------------------------------------------------------------------------

export async function getMutedUntil(userId: string): Promise<Date | null> {
  const mute = await db.query.shoutMutes.findFirst({
    where: and(eq(schema.shoutMutes.userId, userId), gt(schema.shoutMutes.until, new Date())),
    columns: { until: true },
  });
  return mute?.until ?? null;
}

// ----------------------------------------------------------------------------
// Messages
// ----------------------------------------------------------------------------

/**
 * A page of messages, oldest first. Without `before`, the latest page.
 * Deleted messages keep their place but never carry their text.
 */
export async function loadShouts(
  channel: { id: string; readAccess: string; roleIds: string[]; writeAccess: string; reactionsEnabled: boolean },
  viewer: ShoutViewer,
  before?: Date
) {
  const m = schema.shoutMessages;
  const conditions = [eq(m.channelId, channel.id)];
  if (before) conditions.push(lt(m.createdAt, before));

  const rows = await db
    .select({
      id: m.id,
      userId: m.userId,
      body: m.body,
      createdAt: m.createdAt,
      deletedAt: m.deletedAt,
      deletedBy: m.deletedBy,
      username: schema.users.username,
      avatarUrl: schema.users.avatarUrl,
      isAdmin: schema.users.isAdmin,
      isModerator: schema.users.isModerator,
      roleColor: schema.roles.color,
    })
    .from(m)
    .innerJoin(schema.users, eq(schema.users.id, m.userId))
    .leftJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(and(...conditions))
    .orderBy(desc(m.createdAt))
    .limit(SHOUT_PAGE_SIZE + 1);

  const hasMore = rows.length > SHOUT_PAGE_SIZE;
  const page = rows.slice(0, SHOUT_PAGE_SIZE).reverse();

  const reactionRows =
    page.length > 0
      ? await db
          .select({
            messageId: schema.shoutReactions.messageId,
            userId: schema.shoutReactions.userId,
            emoji: schema.shoutReactions.emoji,
          })
          .from(schema.shoutReactions)
          .where(inArray(schema.shoutReactions.messageId, page.map((r) => r.id)))
          .orderBy(asc(schema.shoutReactions.createdAt))
      : [];
  const reactions = summarizeReactions(reactionRows, viewer.id);

  const messages = page.map((row) => {
    const deleted = row.deletedAt !== null;
    return {
      id: row.id,
      body: deleted ? null : row.body,
      createdAt: row.createdAt,
      // Who removed it: the author, or the moderation
      deleted: deleted ? (row.deletedBy === row.userId ? 'author' : 'moderation') : null,
      author: {
        id: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        color: row.roleColor,
        isStaff: isStaff(row),
      },
      reactions: deleted ? [] : (reactions.get(row.id) ?? []),
      canDelete: !deleted && canDeleteShout(row, viewer),
    };
  });

  return {
    messages,
    hasMore,
    canWrite: canWriteChannel(channel, viewer),
    canReact: canReactChannel(channel, viewer),
    canModerate: isStaff(viewer),
  };
}
