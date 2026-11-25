/**
 * Who may edit user content (forum posts and topics, torrent comments).
 * Staff edit everything; authors edit their own text unless the topic is
 * locked. Moving a topic to another category is staff only.
 */
export interface ContentActor {
  id: string;
  isAdmin?: boolean;
  isModerator?: boolean;
}

export function isStaffActor(actor: ContentActor | null | undefined): boolean {
  return !!actor && (!!actor.isAdmin || !!actor.isModerator);
}

export function canEditContent(
  actor: ContentActor | null | undefined,
  content: { authorId: string | null },
  options: { locked?: boolean } = {}
): boolean {
  if (!actor) return false;
  if (isStaffActor(actor)) return true;
  return content.authorId === actor.id && !options.locked;
}

export function canMoveTopic(actor: ContentActor | null | undefined): boolean {
  return isStaffActor(actor);
}
