/**
 * Shoutbox rules, free of DB access (unit tested).
 */

export const READ_ACCESS = ['all', 'roles', 'staff'] as const;
export const WRITE_ACCESS = ['members', 'staff', 'admins'] as const;
export type ReadAccess = (typeof READ_ACCESS)[number];
export type WriteAccess = (typeof WRITE_ACCESS)[number];

export const MAX_SHOUT_LENGTH = 500;
export const MAX_DISTINCT_REACTIONS = 20;
export const MAX_MUTE_MINUTES = 30 * 24 * 60;

export interface ShoutViewer {
  id: string;
  isAdmin: boolean;
  isModerator: boolean;
  roleId: string | null;
}

export interface ChannelAccess {
  readAccess: string;
  roleIds: string[];
  writeAccess: string;
  reactionsEnabled: boolean;
}

export function isStaff(viewer: Pick<ShoutViewer, 'isAdmin' | 'isModerator'>): boolean {
  return viewer.isAdmin || viewer.isModerator;
}

/** Staff read every channel; unknown access values grant nothing */
export function canReadChannel(channel: ChannelAccess, viewer: ShoutViewer): boolean {
  if (isStaff(viewer)) return true;
  if (channel.readAccess === 'all') return true;
  if (channel.readAccess === 'roles') {
    return viewer.roleId !== null && channel.roleIds.includes(viewer.roleId);
  }
  return false;
}

export function canWriteChannel(channel: ChannelAccess, viewer: ShoutViewer): boolean {
  if (!canReadChannel(channel, viewer)) return false;
  switch (channel.writeAccess) {
    case 'members':
      return true;
    case 'staff':
      return isStaff(viewer);
    case 'admins':
      return viewer.isAdmin;
    default:
      return false;
  }
}

export function canReactChannel(channel: ChannelAccess, viewer: ShoutViewer): boolean {
  return channel.reactionsEnabled && canReadChannel(channel, viewer);
}

/** Authors remove their own messages, staff remove any */
export function canDeleteShout(message: { userId: string }, viewer: ShoutViewer): boolean {
  return message.userId === viewer.id || isStaff(viewer);
}

/**
 * Trim, normalize line endings and collapse blank lines.
 * Returns null when the message is empty or too long.
 */
export function normalizeShout(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const body = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (body.length === 0 || body.length > MAX_SHOUT_LENGTH) return null;
  return body;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const PICTOGRAPHIC = /^\p{Extended_Pictographic}/u;
const FLAG = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = /^[0-9#*]️?⃣$/u;

/**
 * A reaction is exactly one emoji (with its modifiers, ZWJ sequences, flags
 * and keycaps). Returns it unchanged, or null for anything else.
 */
export function parseReactionEmoji(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 32) return null;
  const graphemes = [...segmenter.segment(raw)];
  if (graphemes.length !== 1) return null;
  return PICTOGRAPHIC.test(raw) || FLAG.test(raw) || KEYCAP.test(raw) ? raw : null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

/**
 * Group reaction rows per message, emojis in the order they were first used.
 * Rows must be sorted by creation time.
 */
export function summarizeReactions(
  rows: Array<{ messageId: string; userId: string; emoji: string }>,
  viewerId: string
): Map<string, ReactionSummary[]> {
  const byMessage = new Map<string, Map<string, ReactionSummary>>();
  for (const row of rows) {
    let emojis = byMessage.get(row.messageId);
    if (!emojis) {
      emojis = new Map();
      byMessage.set(row.messageId, emojis);
    }
    const entry = emojis.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count++;
    if (row.userId === viewerId) entry.mine = true;
    emojis.set(row.emoji, entry);
  }
  return new Map([...byMessage].map(([id, emojis]) => [id, [...emojis.values()]]));
}

/** Clamp a mute duration to [1 minute, 30 days] and return its end */
export function muteEnd(minutes: number, now: Date): Date {
  const clamped = Math.min(Math.max(Math.round(minutes) || 1, 1), MAX_MUTE_MINUTES);
  return new Date(now.getTime() + clamped * 60_000);
}

/** URL-safe channel slug from its name */
export function channelSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
