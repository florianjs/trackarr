import { describe, it, expect } from 'vitest';
import {
  MAX_MESSAGE_LENGTH,
  isConversationUnread,
  isConversationVisible,
  normalizeMessageBody,
  pairKey,
} from '../server/utils/messageRules';

describe('pairKey', () => {
  it('is the same whatever the order', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
    expect(pairKey('a', 'b')).toBe('a:b');
  });
});

describe('normalizeMessageBody', () => {
  it('trims and normalizes line endings', () => {
    expect(normalizeMessageBody('  hello\r\nworld  ')).toBe('hello\nworld');
  });
  it('collapses long runs of blank lines', () => {
    expect(normalizeMessageBody('a\n\n\n\n\n\nb')).toBe('a\n\n\nb');
  });
  it('rejects empty, whitespace-only, too long and non-string bodies', () => {
    expect(normalizeMessageBody('')).toBeNull();
    expect(normalizeMessageBody('   \n  ')).toBeNull();
    expect(normalizeMessageBody('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
    expect(normalizeMessageBody(42)).toBeNull();
  });
  it('keeps html as plain text (escaped at render time)', () => {
    expect(normalizeMessageBody('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });
});

describe('isConversationUnread', () => {
  const at = new Date('2026-10-08T12:00:00Z');
  it('is unread when the other person wrote after my last read', () => {
    expect(isConversationUnread({ userId: 'me', lastSenderId: 'you', lastMessageAt: at, lastReadAt: null })).toBe(true);
    expect(isConversationUnread({ userId: 'me', lastSenderId: 'you', lastMessageAt: at, lastReadAt: new Date('2026-10-08T11:00:00Z') })).toBe(true);
  });
  it('is read when I wrote last or read it afterwards', () => {
    expect(isConversationUnread({ userId: 'me', lastSenderId: 'me', lastMessageAt: at, lastReadAt: null })).toBe(false);
    expect(isConversationUnread({ userId: 'me', lastSenderId: 'you', lastMessageAt: at, lastReadAt: at })).toBe(false);
  });
});

describe('isConversationVisible', () => {
  const at = new Date('2026-10-08T12:00:00Z');
  it('hides until a newer message arrives', () => {
    expect(isConversationVisible({ hiddenAt: null, lastMessageAt: at })).toBe(true);
    expect(isConversationVisible({ hiddenAt: at, lastMessageAt: at })).toBe(false);
    expect(isConversationVisible({ hiddenAt: new Date('2026-10-08T11:00:00Z'), lastMessageAt: at })).toBe(true);
  });
});
