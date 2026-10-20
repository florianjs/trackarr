import { redis } from '../redis/client';

/**
 * Redis data panic mode deletes instead of encrypting: logs and inboxes
 * holding passkeys, IPs or search queries. Nothing in them is needed to run
 * the site, so they are not restored.
 * Rate-limit and DDoS keys (ratelimit:*, ddos:*) are kept: they expire within
 * 24h and guard the public restore endpoint against brute force.
 */
export const PANIC_PURGED_KEYS = [
  'torznab:logs', // passkey, IP, query, user agent per request
  'torznab:user:stats', // keyed by passkey
  'torznab:blocked', // keyed by passkey
  'security:alerts', // admin alert inbox: IPs, user agents
  'tracker:abuse_events', // raw IPs, user ids, info hashes (tracker service)
];
export const PANIC_PURGED_PATTERNS = [
  'torznab:user:logs:*', // per passkey request logs
];

/** Returns the number of keys deleted */
export async function purgePanicRedisData(): Promise<number> {
  let deleted = await redis.del(...PANIC_PURGED_KEYS);

  // SCAN patterns are not prefixed by ioredis, the keys it returns are
  // prefixed while DEL prefixes again: add and strip the prefix ourselves
  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'ot:';
  for (const pattern of PANIC_PURGED_PATTERNS) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${keyPrefix}${pattern}`, 'COUNT', 500);
      cursor = next;
      const unprefixed = keys.map((k) => (k.startsWith(keyPrefix) ? k.slice(keyPrefix.length) : k));
      if (unprefixed.length > 0) deleted += await redis.del(...unprefixed);
    } while (cursor !== '0');
  }
  return deleted;
}
