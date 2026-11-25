/**
 * Bounty state machine, shared by the API and the pages so buttons match
 * what the server accepts
 */
export type BountyStatus = 'open' | 'claimed' | 'filled' | 'cancelled';
export type BountyAction = 'contribute' | 'fill' | 'accept' | 'reject' | 'cancel' | 'edit' | 'delete';

export interface BountyActor {
  userId: string;
  isStaff: boolean;
}

/**
 * Who may do what on a bounty, given its state.
 * - open: anyone contributes or submits a fill; requester/staff cancel or edit
 * - claimed (fill pending review): requester/staff accept or reject; staff
 *   may also cancel (refund) or edit
 * - filled / cancelled: final, staff may still fix the text
 * - delete: staff only, any state (spam, duplicates)
 */
export function canBountyAction(
  bounty: { status: string; requesterId: string },
  action: BountyAction,
  actor: BountyActor
): boolean {
  const isOwnerOrStaff = actor.userId === bounty.requesterId || actor.isStaff;

  switch (action) {
    case 'contribute':
      return bounty.status === 'open';
    case 'fill':
      return bounty.status === 'open';
    case 'accept':
    case 'reject':
      return bounty.status === 'claimed' && isOwnerOrStaff;
    case 'cancel':
      return (bounty.status === 'open' && isOwnerOrStaff) || (bounty.status === 'claimed' && actor.isStaff);
    case 'edit':
      return (bounty.status === 'open' && isOwnerOrStaff) || actor.isStaff;
    case 'delete':
      return actor.isStaff;
    default:
      return false;
  }
}
