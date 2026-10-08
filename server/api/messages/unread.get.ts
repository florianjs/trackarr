import { sql } from 'drizzle-orm';
import { db } from '../../db';

/**
 * GET /api/messages/unread
 * Number of conversations with a message I have not read (sidebar badge)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuthSession(event);

  const [row] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from conversation_members cm
    join conversations c on c.id = cm.conversation_id
    where cm.user_id = ${user.id}
      and (cm.hidden_at is null or cm.hidden_at < c.last_message_at)
      and (cm.last_read_at is null or cm.last_read_at < c.last_message_at)
      and (
        select pm.sender_id from private_messages pm
        where pm.conversation_id = c.id
        order by pm.created_at desc
        limit 1
      ) <> ${user.id}
  `);

  return { count: Number(row?.count ?? 0) };
});
