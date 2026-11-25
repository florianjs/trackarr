import { describe, it, expect } from 'vitest';
import {
  deletedUsername,
  isDeletedUsername,
  moderationRights,
  randomDeletedUsername,
  userEditSchema,
  usernameSchema,
} from '../shared/utils/userModeration';

const member = { id: 'member', isAdmin: false, isModerator: false };
const mod = { id: 'mod', isAdmin: false, isModerator: true };
const otherMod = { id: 'mod2', isAdmin: false, isModerator: true };
const admin = { id: 'admin', isAdmin: true, isModerator: false };
const otherAdmin = { id: 'admin2', isAdmin: true, isModerator: false };

describe('moderationRights', () => {
  it('gives nothing to members, guests or on your own profile', () => {
    expect(moderationRights(null, member).view).toBe(false);
    expect(moderationRights({ ...member, id: 'x' }, member).view).toBe(false);
    expect(moderationRights(mod, mod).view).toBe(false);
    expect(moderationRights(admin, admin).view).toBe(false);
  });

  it('lets a moderator moderate members but not edit or delete them', () => {
    expect(moderationRights(mod, member)).toEqual({
      view: true,
      ban: true,
      mute: true,
      moderate: true,
      edit: false,
      delete: false,
    });
  });

  it('keeps moderators away from other staff', () => {
    for (const target of [otherMod, admin]) {
      const rights = moderationRights(mod, target);
      expect(rights.view).toBe(true);
      expect(rights.ban || rights.mute || rights.moderate || rights.edit || rights.delete).toBe(false);
    }
  });

  it('gives admins every action on members and moderators', () => {
    expect(moderationRights(admin, member)).toEqual({
      view: true,
      ban: true,
      mute: true,
      moderate: true,
      edit: true,
      delete: true,
    });
    const onMod = moderationRights(admin, otherMod);
    expect(onMod.ban).toBe(true);
    expect(onMod.delete).toBe(true);
    expect(onMod.mute).toBe(false);
  });

  it('never lets an admin ban or delete another admin', () => {
    const rights = moderationRights(admin, otherAdmin);
    expect(rights.ban).toBe(false);
    expect(rights.delete).toBe(false);
    expect(rights.edit).toBe(true);
  });
});

describe('usernameSchema', () => {
  it('follows the sign-up rules', () => {
    expect(usernameSchema.parse(' new_name ')).toBe('new_name');
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('a'.repeat(21)).success).toBe(false);
    expect(usernameSchema.safeParse('bad name').success).toBe(false);
  });

  it('reserves the prefix of deleted accounts', () => {
    expect(usernameSchema.safeParse('deleted_0f8c2a4e1b2c').success).toBe(false);
    expect(usernameSchema.safeParse('Deleted_bob').success).toBe(false);
    expect(usernameSchema.safeParse('undeleted_bob').success).toBe(true);
  });
});

describe('userEditSchema', () => {
  it('needs at least one field', () => {
    expect(userEditSchema.safeParse({}).success).toBe(false);
    expect(userEditSchema.safeParse({ invitesRemaining: 0 }).success).toBe(true);
    expect(userEditSchema.safeParse({ invitesRemaining: -1 }).success).toBe(false);
    expect(userEditSchema.safeParse({ invitesRemaining: 1.5 }).success).toBe(false);
  });
});

describe('deletedUsername', () => {
  it('is stable, short enough for sign-up rules and recognisable', () => {
    const name = deletedUsername('0f8c2a4e-1b2c-4d5e-8f90-123456789abc');
    expect(name).toBe('deleted_0f8c2a4e1b2c');
    expect(name.length).toBeLessThanOrEqual(20);
    expect(isDeletedUsername(name)).toBe(true);
    expect(isDeletedUsername('deletedfan')).toBe(false);
  });

  it('has a random fallback in the same format', () => {
    const name = randomDeletedUsername(() => 0.5);
    expect(name).toBe('deleted_888888888888');
    expect(isDeletedUsername(randomDeletedUsername())).toBe(true);
  });
});
