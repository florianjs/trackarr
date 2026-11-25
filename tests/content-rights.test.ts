import { describe, it, expect } from 'vitest';
import { canEditContent, canMoveTopic } from '../shared/utils/contentRights';

const author = { id: 'a', isAdmin: false, isModerator: false };
const other = { id: 'b', isAdmin: false, isModerator: false };
const mod = { id: 'm', isAdmin: false, isModerator: true };
const admin = { id: 'x', isAdmin: true, isModerator: false };
const post = { authorId: 'a' };

describe('canEditContent', () => {
  it('lets authors edit their own content', () => {
    expect(canEditContent(author, post)).toBe(true);
    expect(canEditContent(other, post)).toBe(false);
    expect(canEditContent(null, post)).toBe(false);
  });

  it('freezes authors in a locked topic', () => {
    expect(canEditContent(author, post, { locked: true })).toBe(false);
  });

  it('lets staff edit anything, locked or orphaned', () => {
    expect(canEditContent(mod, post, { locked: true })).toBe(true);
    expect(canEditContent(admin, { authorId: null })).toBe(true);
    expect(canEditContent(author, { authorId: null })).toBe(false);
  });
});

describe('canMoveTopic', () => {
  it('is staff only', () => {
    expect(canMoveTopic(mod)).toBe(true);
    expect(canMoveTopic(admin)).toBe(true);
    expect(canMoveTopic(author)).toBe(false);
    expect(canMoveTopic(null)).toBe(false);
  });
});
