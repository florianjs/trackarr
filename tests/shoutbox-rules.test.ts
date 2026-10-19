import { describe, it, expect } from 'vitest';
import {
  canDeleteShout,
  canReactChannel,
  canReadChannel,
  canWriteChannel,
  channelSlug,
  muteEnd,
  normalizeShout,
  parseReactionEmoji,
  summarizeReactions,
  MAX_SHOUT_LENGTH,
  type ChannelAccess,
  type ShoutViewer,
} from '../server/utils/shoutboxRules';

const member: ShoutViewer = { id: 'm', isAdmin: false, isModerator: false, roleId: null };
const vip: ShoutViewer = { ...member, id: 'v', roleId: 'role-vip' };
const mod: ShoutViewer = { ...member, id: 'mod', isModerator: true };
const admin: ShoutViewer = { ...member, id: 'a', isAdmin: true };

const channel = (over: Partial<ChannelAccess> = {}): ChannelAccess => ({
  readAccess: 'all',
  roleIds: [],
  writeAccess: 'members',
  reactionsEnabled: true,
  ...over,
});

describe('channel access', () => {
  it('opens public channels to every member', () => {
    expect(canReadChannel(channel(), member)).toBe(true);
    expect(canWriteChannel(channel(), member)).toBe(true);
  });

  it('restricts role channels to listed roles, staff always in', () => {
    const vipOnly = channel({ readAccess: 'roles', roleIds: ['role-vip'] });
    expect(canReadChannel(vipOnly, member)).toBe(false);
    expect(canReadChannel(vipOnly, vip)).toBe(true);
    expect(canReadChannel(vipOnly, mod)).toBe(true);
    expect(canWriteChannel(vipOnly, member)).toBe(false);
  });

  it('hides staff channels from members', () => {
    const staffOnly = channel({ readAccess: 'staff' });
    expect(canReadChannel(staffOnly, vip)).toBe(false);
    expect(canReadChannel(staffOnly, mod)).toBe(true);
  });

  it('lets everyone react but only admins post in announcements', () => {
    const announcements = channel({ writeAccess: 'admins' });
    expect(canWriteChannel(announcements, member)).toBe(false);
    expect(canWriteChannel(announcements, mod)).toBe(false);
    expect(canWriteChannel(announcements, admin)).toBe(true);
    expect(canReactChannel(announcements, member)).toBe(true);
  });

  it('honours staff-only posting and disabled reactions', () => {
    expect(canWriteChannel(channel({ writeAccess: 'staff' }), member)).toBe(false);
    expect(canWriteChannel(channel({ writeAccess: 'staff' }), mod)).toBe(true);
    expect(canReactChannel(channel({ reactionsEnabled: false }), member)).toBe(false);
  });

  it('grants nothing on unknown access values', () => {
    expect(canReadChannel(channel({ readAccess: 'nope' }), member)).toBe(false);
    expect(canWriteChannel(channel({ writeAccess: 'nope' }), admin)).toBe(false);
  });
});

describe('canDeleteShout', () => {
  it('allows the author and staff only', () => {
    expect(canDeleteShout({ userId: 'm' }, member)).toBe(true);
    expect(canDeleteShout({ userId: 'other' }, member)).toBe(false);
    expect(canDeleteShout({ userId: 'other' }, mod)).toBe(true);
  });
});

describe('normalizeShout', () => {
  it('trims and collapses blank lines', () => {
    expect(normalizeShout('  hello\r\n\r\n\r\n\r\nworld  ')).toBe('hello\n\nworld');
  });

  it('rejects empty, too long and non-string input', () => {
    expect(normalizeShout('   ')).toBeNull();
    expect(normalizeShout('x'.repeat(MAX_SHOUT_LENGTH + 1))).toBeNull();
    expect(normalizeShout(42)).toBeNull();
    expect(normalizeShout('x'.repeat(MAX_SHOUT_LENGTH))).not.toBeNull();
  });
});

describe('parseReactionEmoji', () => {
  it('accepts single emojis, including sequences', () => {
    for (const emoji of ['👍', '❤️', '🎉', '👍🏽', '👨‍👩‍👧', '🇫🇷', '1️⃣']) {
      expect(parseReactionEmoji(emoji)).toBe(emoji);
    }
  });

  it('rejects text, several emojis and markup', () => {
    for (const value of ['a', '👍👍', ':+1:', '<b>', '', ' 👍', 1]) {
      expect(parseReactionEmoji(value)).toBeNull();
    }
  });
});

describe('summarizeReactions', () => {
  it('counts per emoji in first-use order and flags the viewer', () => {
    const result = summarizeReactions(
      [
        { messageId: 'x', userId: 'a', emoji: '🔥' },
        { messageId: 'x', userId: 'm', emoji: '👍' },
        { messageId: 'x', userId: 'b', emoji: '🔥' },
        { messageId: 'y', userId: 'b', emoji: '👀' },
      ],
      'm'
    );
    expect(result.get('x')).toEqual([
      { emoji: '🔥', count: 2, mine: false },
      { emoji: '👍', count: 1, mine: true },
    ]);
    expect(result.get('y')).toEqual([{ emoji: '👀', count: 1, mine: false }]);
  });
});

describe('muteEnd', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('clamps the duration', () => {
    expect(muteEnd(10, now).toISOString()).toBe('2026-01-01T00:10:00.000Z');
    expect(muteEnd(0, now).toISOString()).toBe('2026-01-01T00:01:00.000Z');
    expect(muteEnd(10 ** 9, now).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('channelSlug', () => {
  it('builds a URL-safe slug', () => {
    expect(channelSlug('Annonces & Infos !')).toBe('annonces-infos');
    expect(channelSlug('Général')).toBe('general');
  });
});
