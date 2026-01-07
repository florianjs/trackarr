import { db, schema } from '../../db';

export default defineEventHandler(async (event) => {
  // Public endpoint - tags are visible to all authenticated users
  await requireUserSession(event);

  const tags = await db.query.tags.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return tags;
});
