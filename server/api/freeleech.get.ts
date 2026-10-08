import { getFreeleechState } from '../utils/settings';

/**
 * GET /api/freeleech
 * Current global freeleech, for the site banner
 */
export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  const state = await getFreeleechState();
  return { active: state.active, until: state.active ? state.until : null };
});
