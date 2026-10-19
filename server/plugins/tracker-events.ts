import { inArray } from 'drizzle-orm';

const INTERVAL_MS = 60_000;
const EVENTS_KEY = 'tracker:abuse_events';

// Turn abuse reported by the tracker service into admin alerts. One node per
// minute drains the list (claim), so alerts are not sent twice.
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'test') return;

  setInterval(async () => {
    let raw: string[] = [];
    let done = 0;
    try {
      const { redis } = await import('../redis/client');
      const { claim } = await import('../redis/claim');
      if (!(await claim(redis, 'job:tracker-events', INTERVAL_MS * 0.9))) return;

      const result = await redis.multi().lrange(EVENTS_KEY, 0, -1).del(EVENTS_KEY).exec();
      raw = (result?.[0]?.[1] as string[] | undefined) ?? [];
      if (raw.length === 0) return;

      const { parseTrackerEvent, trackerEventAlert } = await import('../utils/trackerEvents');
      const { sendSecurityAlert } = await import('../utils/alerts');
      const events = raw.map(parseTrackerEvent);

      // Usernames read better than ids in an alert
      const userIds = [
        ...new Set(events.flatMap((e) => (e?.kind === 'impossible_upload' ? [e.user_id] : []))),
      ];
      const names = new Map<string, string>();
      if (userIds.length > 0) {
        const { db, schema } = await import('../db');
        const rows = await db
          .select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users)
          .where(inArray(schema.users.id, userIds));
        for (const row of rows) names.set(row.id, row.username);
      }

      for (const event of events) {
        if (event) {
          const username = event.kind === 'impossible_upload' ? names.get(event.user_id) : null;
          const { type, subject, ...details } = trackerEventAlert(event, username);
          await sendSecurityAlert(type, details, subject);
        }
        done++;
      }
    } catch (err) {
      console.error('[Security] Tracker events not processed:', err);
      // Back at the old end of the list (newest first), for the next run
      const left = raw.slice(done);
      if (left.length > 0) {
        const { redis } = await import('../redis/client');
        await redis.rpush(EVENTS_KEY, ...left).catch(() => {});
      }
    }
  }, INTERVAL_MS);
});
