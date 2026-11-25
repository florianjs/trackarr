import { z } from 'zod';

/**
 * Staff bulk actions from the torrent and bounty lists. One request for the
 * whole selection, so the per-item mutation rate limit is not hit.
 */
export const MAX_BULK_ITEMS = 100;

const infoHash = z
  .string()
  .regex(/^[a-fA-F0-9]{40}$/, 'Invalid info hash')
  .transform((h) => h.toLowerCase());

/** Same item twice must not be counted or processed twice */
const unique = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .min(1, 'Nothing selected')
    .max(MAX_BULK_ITEMS, `At most ${MAX_BULK_ITEMS} items at once`)
    .transform((items) => [...new Set(items as z.infer<T>[])]);

export const torrentBulkSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), infoHashes: unique(infoHash) }),
  z.object({ action: z.literal('delete'), infoHashes: unique(infoHash) }),
  z.object({
    action: z.literal('category'),
    infoHashes: unique(infoHash),
    categoryId: z.uuid().nullable(),
  }),
]);
export type TorrentBulkInput = z.input<typeof torrentBulkSchema>;

export const bountyBulkSchema = z.object({
  action: z.enum(['cancel', 'delete']),
  ids: unique(z.uuid()),
});
export type BountyBulkInput = z.input<typeof bountyBulkSchema>;

/** Toggle one id in a selection, keeping the order */
export function toggleSelection(selection: readonly string[], id: string): string[] {
  return selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
}

/** Select all visible rows, or clear them when they are all selected already */
export function toggleAll(selection: readonly string[], visible: readonly string[]): string[] {
  const allSelected = visible.length > 0 && visible.every((id) => selection.includes(id));
  if (allSelected) return selection.filter((id) => !visible.includes(id));
  return [...new Set([...selection, ...visible])];
}
