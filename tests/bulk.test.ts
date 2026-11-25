import { describe, it, expect } from 'vitest';
import {
  MAX_BULK_ITEMS,
  bountyBulkSchema,
  toggleAll,
  toggleSelection,
  torrentBulkSchema,
} from '../shared/utils/bulk';

const hash = (n: number) => n.toString(16).padStart(40, '0');

describe('torrentBulkSchema', () => {
  it('lowercases and dedupes info hashes', () => {
    const upper = 'A'.repeat(40);
    const parsed = torrentBulkSchema.parse({ action: 'approve', infoHashes: [upper, 'a'.repeat(40)] });
    expect(parsed.infoHashes).toEqual(['a'.repeat(40)]);
  });

  it('rejects empty, oversized or malformed selections', () => {
    expect(torrentBulkSchema.safeParse({ action: 'delete', infoHashes: [] }).success).toBe(false);
    expect(torrentBulkSchema.safeParse({ action: 'delete', infoHashes: ['xyz'] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => hash(i));
    expect(torrentBulkSchema.safeParse({ action: 'delete', infoHashes: tooMany }).success).toBe(false);
  });

  it('needs a category (or null) to recategorise', () => {
    expect(torrentBulkSchema.safeParse({ action: 'category', infoHashes: [hash(1)] }).success).toBe(false);
    expect(
      torrentBulkSchema.safeParse({ action: 'category', infoHashes: [hash(1)], categoryId: null }).success
    ).toBe(true);
  });

  it('rejects unknown actions', () => {
    expect(torrentBulkSchema.safeParse({ action: 'nuke', infoHashes: [hash(1)] }).success).toBe(false);
  });
});

describe('bountyBulkSchema', () => {
  it('takes uuids and an action', () => {
    const id = '0f8c2a4e-1b2c-4d5e-8f90-123456789abc';
    expect(bountyBulkSchema.parse({ action: 'cancel', ids: [id, id] }).ids).toEqual([id]);
    expect(bountyBulkSchema.safeParse({ action: 'cancel', ids: ['nope'] }).success).toBe(false);
    expect(bountyBulkSchema.safeParse({ action: 'accept', ids: [id] }).success).toBe(false);
  });
});

describe('selection helpers', () => {
  it('toggles one id', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('selects every visible row, then clears them', () => {
    expect(toggleAll(['x'], ['a', 'b'])).toEqual(['x', 'a', 'b']);
    expect(toggleAll(['x', 'a', 'b'], ['a', 'b'])).toEqual(['x']);
    expect(toggleAll([], [])).toEqual([]);
  });
});
