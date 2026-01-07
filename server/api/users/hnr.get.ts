import { eq } from 'drizzle-orm';
import { getUserHnrEntries, getUserHnrCount } from '../../utils/hnr';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const [entries, count] = await Promise.all([
    getUserHnrEntries(user.id),
    getUserHnrCount(user.id),
  ]);

  return {
    entries,
    hnrCount: count,
  };
});
