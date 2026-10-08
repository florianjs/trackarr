/**
 * Private message rules, free of DB access (unit tested).
 */

export const MAX_MESSAGE_LENGTH = 5000;

/** One conversation per pair of users, whatever the order */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Trim, normalize line endings and collapse long runs of blank lines.
 * Returns null when the message is empty or too long.
 */
export function normalizeMessageBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const body = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (body.length === 0 || body.length > MAX_MESSAGE_LENGTH) return null;
  return body;
}

/** Unread when the last message is from the other person and newer than the last read */
export function isConversationUnread(input: {
  userId: string;
  lastSenderId: string | null;
  lastMessageAt: Date;
  lastReadAt: Date | null;
}): boolean {
  if (!input.lastSenderId || input.lastSenderId === input.userId) return false;
  return !input.lastReadAt || input.lastReadAt < input.lastMessageAt;
}

/** A hidden conversation comes back when a newer message arrives */
export function isConversationVisible(input: {
  hiddenAt: Date | null;
  lastMessageAt: Date;
}): boolean {
  return !input.hiddenAt || input.hiddenAt < input.lastMessageAt;
}
