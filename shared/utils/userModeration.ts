import { z } from 'zod';

/**
 * What a staff member may do to a member from their profile. Moderators act
 * on regular members only; admins act on everyone but other admins for the
 * destructive actions (an admin is demoted first).
 */
export interface ModerationActor {
  id: string;
  isAdmin: boolean;
  isModerator: boolean;
}

export type ModerationTarget = ModerationActor;

export interface ModerationRights {
  /** Panel shown at all */
  view: boolean;
  ban: boolean;
  /** Shoutbox mute: staff are never muted */
  mute: boolean;
  /** Remove avatar, sign out everywhere, lift the multi-account hold */
  moderate: boolean;
  /** Username, invites, roles, ratio, bonus, passkey (admin only) */
  edit: boolean;
  /** Anonymise the account (admin only, never another admin) */
  delete: boolean;
}

const NONE: ModerationRights = {
  view: false,
  ban: false,
  mute: false,
  moderate: false,
  edit: false,
  delete: false,
};

export function isStaffMember(user: Pick<ModerationActor, 'isAdmin' | 'isModerator'>): boolean {
  return user.isAdmin || user.isModerator;
}

export function moderationRights(actor: ModerationActor | null | undefined, target: ModerationTarget): ModerationRights {
  if (!actor || !isStaffMember(actor) || actor.id === target.id) return NONE;

  const targetStaff = isStaffMember(target);
  const overTarget = actor.isAdmin || !targetStaff;

  return {
    view: true,
    ban: overTarget && !target.isAdmin,
    mute: !targetStaff,
    moderate: overTarget,
    edit: actor.isAdmin,
    delete: actor.isAdmin && !target.isAdmin,
  };
}

/** Same rules as sign-up */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

export const MAX_INVITES = 1000;

export const userEditSchema = z
  .object({
    username: usernameSchema.optional(),
    invitesRemaining: z.number().int().min(0).max(MAX_INVITES).optional(),
  })
  .refine((v) => v.username !== undefined || v.invitesRemaining !== undefined, {
    message: 'Nothing to change',
  });
export type UserEditInput = z.infer<typeof userEditSchema>;

/**
 * Name given to a deleted account: frees the original one and stays unique
 * (derived from the id), within the sign-up rules
 */
export function deletedUsername(userId: string): string {
  return `deleted_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
}

export function isDeletedUsername(username: string): boolean {
  return /^deleted_[a-zA-Z0-9]{1,12}$/.test(username);
}
