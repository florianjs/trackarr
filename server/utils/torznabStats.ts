/**
 * Torznab API Statistics and Logging
 * Tracks API usage, logs requests, and manages user-specific stats
 */

import { redis } from '../redis/client';

// Redis key prefixes
const KEYS = {
  STATS: 'torznab:stats',
  LOGS: 'torznab:logs',
  USER_STATS: 'torznab:user:stats',
  USER_LOGS: 'torznab:user:logs',
  BLOCKED: 'torznab:blocked',
  HOURLY: 'torznab:hourly',
  RATE_LIMIT_HITS: 'torznab:rate_limit_hits',
};

// Stats TTL (30 days)
const STATS_TTL = 30 * 24 * 60 * 60;
// Logs TTL (7 days)
const LOGS_TTL = 7 * 24 * 60 * 60;

interface TorznabLogEntry {
  timestamp: number;
  passkey: string;
  function: string;
  query?: string;
  ip: string;
  userAgent?: string;
  responseTime: number;
  resultCount: number;
  error?: string;
}

interface TorznabUserStats {
  totalRequests: number;
  searchRequests: number;
  downloadRequests: number;
  lastRequest: number;
  rateLimitHits: number;
}

interface TorznabStats {
  totalRequests: number;
  searchRequests: number;
  downloadRequests: number;
  capsRequests: number;
  tvSearchRequests: number;
  movieSearchRequests: number;
  errorsCount: number;
  uniqueUsers: number;
  avgResponseTime: number;
  last24hRequests: number;
}

// ============================================================================
// Global Stats
// ============================================================================

/**
 * Increment a stat counter
 */
async function incrementStat(field: string, amount = 1): Promise<void> {
  try {
    await redis.hincrby(KEYS.STATS, field, amount);
    await redis.expire(KEYS.STATS, STATS_TTL);
  } catch (error) {
    console.error('[Torznab Stats] Failed to increment stat:', error);
  }
}

/**
 * Get all Torznab stats
 */
export async function getTorznabStats(): Promise<TorznabStats> {
  try {
    const data = await redis.hgetall(KEYS.STATS);

    // Get unique users count from user stats hash
    const userKeys = await redis.hkeys(KEYS.USER_STATS);

    // Get last 24h requests
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    let last24hRequests = 0;

    for (let i = 0; i < 24; i++) {
      const hourKey = `${KEYS.HOURLY}:${Math.floor((now - i * 60 * 60 * 1000) / (60 * 60 * 1000))}`;
      const count = await redis.get(hourKey);
      if (count) {
        last24hRequests += parseInt(count, 10);
      }
    }

    return {
      totalRequests: parseInt(data.totalRequests || '0', 10),
      searchRequests: parseInt(data.searchRequests || '0', 10),
      downloadRequests: parseInt(data.downloadRequests || '0', 10),
      capsRequests: parseInt(data.capsRequests || '0', 10),
      tvSearchRequests: parseInt(data.tvSearchRequests || '0', 10),
      movieSearchRequests: parseInt(data.movieSearchRequests || '0', 10),
      errorsCount: parseInt(data.errorsCount || '0', 10),
      uniqueUsers: userKeys.length,
      avgResponseTime: parseFloat(data.avgResponseTime || '0'),
      last24hRequests,
    };
  } catch (error) {
    console.error('[Torznab Stats] Failed to get stats:', error);
    return {
      totalRequests: 0,
      searchRequests: 0,
      downloadRequests: 0,
      capsRequests: 0,
      tvSearchRequests: 0,
      movieSearchRequests: 0,
      errorsCount: 0,
      uniqueUsers: 0,
      avgResponseTime: 0,
      last24hRequests: 0,
    };
  }
}

/**
 * Log a Torznab request
 */
export async function logTorznabRequest(entry: TorznabLogEntry): Promise<void> {
  try {
    const logEntry = JSON.stringify(entry);

    // Add to global logs (capped at 1000 entries)
    await redis.lpush(KEYS.LOGS, logEntry);
    await redis.ltrim(KEYS.LOGS, 0, 999);
    await redis.expire(KEYS.LOGS, LOGS_TTL);

    // Add to user-specific logs
    const userLogKey = `${KEYS.USER_LOGS}:${entry.passkey}`;
    await redis.lpush(userLogKey, logEntry);
    await redis.ltrim(userLogKey, 0, 99);
    await redis.expire(userLogKey, LOGS_TTL);

    // Update global stats
    await incrementStat('totalRequests');

    // Track by function type
    switch (entry.function) {
      case 'search':
        await incrementStat('searchRequests');
        break;
      case 'tvsearch':
        await incrementStat('tvSearchRequests');
        break;
      case 'movie':
        await incrementStat('movieSearchRequests');
        break;
      case 'caps':
        await incrementStat('capsRequests');
        break;
    }

    if (entry.error) {
      await incrementStat('errorsCount');
    }

    // Track hourly requests
    const hourKey = `${KEYS.HOURLY}:${Math.floor(Date.now() / (60 * 60 * 1000))}`;
    await redis.incr(hourKey);
    await redis.expire(hourKey, 25 * 60 * 60); // Keep for 25 hours

    // Update user stats
    await updateUserStats(entry.passkey, entry.function);

    // Update rolling average response time
    const currentAvg = parseFloat(
      (await redis.hget(KEYS.STATS, 'avgResponseTime')) || '0'
    );
    const total = parseInt(
      (await redis.hget(KEYS.STATS, 'totalRequests')) || '1',
      10
    );
    const newAvg = (currentAvg * (total - 1) + entry.responseTime) / total;
    await redis.hset(KEYS.STATS, 'avgResponseTime', newAvg.toFixed(2));
  } catch (error) {
    console.error('[Torznab Stats] Failed to log request:', error);
  }
}

/**
 * Get recent logs with pagination
 */
export async function getTorznabRecentLogs(
  limit = 50,
  offset = 0
): Promise<{ logs: TorznabLogEntry[]; total: number }> {
  try {
    const total = await redis.llen(KEYS.LOGS);
    const logs = await redis.lrange(KEYS.LOGS, offset, offset + limit - 1);
    const parsedLogs = logs
      .map((log) => {
        try {
          const entry = JSON.parse(log);
          // Mask passkey in logs
          entry.passkey = `${entry.passkey.substring(0, 8)}...`;
          // Mask IP
          entry.ip = entry.ip.split('.').slice(0, 2).join('.') + '.*.*';
          return entry;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as TorznabLogEntry[];
    return { logs: parsedLogs, total };
  } catch (error) {
    console.error('[Torznab Stats] Failed to get logs:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Get logs for a specific user with pagination
 */
export async function getTorznabLogsByUser(
  passkey: string,
  limit = 50,
  offset = 0
): Promise<{ logs: TorznabLogEntry[]; total: number }> {
  try {
    const key = `${KEYS.USER_LOGS}:${passkey}`;
    const total = await redis.llen(key);
    const logs = await redis.lrange(key, offset, offset + limit - 1);
    const parsedLogs = logs
      .map((log) => {
        try {
          const entry = JSON.parse(log);
          entry.passkey = `${entry.passkey.substring(0, 8)}...`;
          entry.ip = entry.ip.split('.').slice(0, 2).join('.') + '.*.*';
          return entry;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as TorznabLogEntry[];
    return { logs: parsedLogs, total };
  } catch (error) {
    console.error('[Torznab Stats] Failed to get user logs:', error);
    return { logs: [], total: 0 };
  }
}

// ============================================================================
// User Stats
// ============================================================================

/**
 * Update user-specific stats
 */
async function updateUserStats(passkey: string, func: string): Promise<void> {
  try {
    const key = KEYS.USER_STATS;
    const existing = await redis.hget(key, passkey);

    let stats: TorznabUserStats = existing
      ? JSON.parse(existing)
      : {
          totalRequests: 0,
          searchRequests: 0,
          downloadRequests: 0,
          lastRequest: 0,
          rateLimitHits: 0,
        };

    stats.totalRequests++;
    stats.lastRequest = Date.now();

    if (func === 'search' || func === 'tvsearch' || func === 'movie') {
      stats.searchRequests++;
    } else if (func === 'download') {
      stats.downloadRequests++;
    }

    await redis.hset(key, passkey, JSON.stringify(stats));
    await redis.expire(key, STATS_TTL);
  } catch (error) {
    console.error('[Torznab Stats] Failed to update user stats:', error);
  }
}

/**
 * Get stats for a specific user
 */
export async function getTorznabUserStats(
  passkey: string
): Promise<TorznabUserStats | null> {
  try {
    const data = await redis.hget(KEYS.USER_STATS, passkey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[Torznab Stats] Failed to get user stats:', error);
    return null;
  }
}

/**
 * Clear stats for a specific user (used when resetting passkey)
 */
export async function clearTorznabUserStats(passkey: string): Promise<void> {
  try {
    await redis.hdel(KEYS.USER_STATS, passkey);
    await redis.del(`${KEYS.USER_LOGS}:${passkey}`);
  } catch (error) {
    console.error('[Torznab Stats] Failed to clear user stats:', error);
  }
}

/**
 * Get top users by request count
 */
export async function getTorznabTopUsers(
  limit = 10
): Promise<Array<{ passkey: string; stats: TorznabUserStats }>> {
  try {
    const allStats = await redis.hgetall(KEYS.USER_STATS);
    const users: Array<{ passkey: string; stats: TorznabUserStats }> = [];

    for (const [passkey, data] of Object.entries(allStats)) {
      try {
        const stats = JSON.parse(data);
        users.push({
          passkey: `${passkey.substring(0, 8)}...${passkey.substring(36)}`,
          stats,
        });
      } catch {
        // Skip invalid entries
      }
    }

    // Sort by total requests
    return users
      .sort((a, b) => b.stats.totalRequests - a.stats.totalRequests)
      .slice(0, limit);
  } catch (error) {
    console.error('[Torznab Stats] Failed to get top users:', error);
    return [];
  }
}

/**
 * Get requests by hour (last N hours)
 */
export async function getTorznabRequestsByHour(
  hours = 24
): Promise<Array<{ hour: number; count: number }>> {
  try {
    const now = Date.now();
    const result: Array<{ hour: number; count: number }> = [];

    for (let i = hours - 1; i >= 0; i--) {
      const timestamp = now - i * 60 * 60 * 1000;
      const hourKey = `${KEYS.HOURLY}:${Math.floor(timestamp / (60 * 60 * 1000))}`;
      const count = await redis.get(hourKey);
      result.push({
        hour: Math.floor(timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000),
        count: count ? parseInt(count, 10) : 0,
      });
    }

    return result;
  } catch (error) {
    console.error('[Torznab Stats] Failed to get hourly requests:', error);
    return [];
  }
}

/**
 * Track rate limit hit
 */
export async function trackRateLimitHit(passkey: string): Promise<void> {
  try {
    // Update global count
    await redis.hincrby(KEYS.RATE_LIMIT_HITS, 'total', 1);
    await redis.expire(KEYS.RATE_LIMIT_HITS, STATS_TTL);

    // Update user stats
    const existing = await redis.hget(KEYS.USER_STATS, passkey);
    if (existing) {
      const stats = JSON.parse(existing);
      stats.rateLimitHits = (stats.rateLimitHits || 0) + 1;
      await redis.hset(KEYS.USER_STATS, passkey, JSON.stringify(stats));
    }
  } catch (error) {
    console.error('[Torznab Stats] Failed to track rate limit hit:', error);
  }
}

/**
 * Get rate limit hit stats
 */
export async function getTorznabRateLimitHits(): Promise<{
  total: number;
  byHour: Array<{ hour: number; count: number }>;
}> {
  try {
    const data = await redis.hgetall(KEYS.RATE_LIMIT_HITS);
    return {
      total: parseInt(data.total || '0', 10),
      byHour: [], // Could implement hourly tracking if needed
    };
  } catch (error) {
    console.error('[Torznab Stats] Failed to get rate limit hits:', error);
    return { total: 0, byHour: [] };
  }
}

// ============================================================================
// User Blocking
// ============================================================================

/**
 * Block a user from Torznab API
 */
export async function blockTorznabUser(
  passkey: string,
  reason: string
): Promise<void> {
  try {
    await redis.hset(
      KEYS.BLOCKED,
      passkey,
      JSON.stringify({
        reason,
        blockedAt: Date.now(),
      })
    );
  } catch (error) {
    console.error('[Torznab Stats] Failed to block user:', error);
  }
}

/**
 * Unblock a user from Torznab API
 */
export async function unblockTorznabUser(passkey: string): Promise<void> {
  try {
    await redis.hdel(KEYS.BLOCKED, passkey);
  } catch (error) {
    console.error('[Torznab Stats] Failed to unblock user:', error);
  }
}

/**
 * Copy an API block to a new passkey before a reset, so the reset does not
 * lift it. Throws on Redis errors: better no reset than a lost block.
 * Returns whether there was a block.
 */
export async function copyTorznabBlock(oldPasskey: string, newPasskey: string): Promise<boolean> {
  const data = await redis.hget(KEYS.BLOCKED, oldPasskey);
  if (!data) return false;
  await redis.hset(KEYS.BLOCKED, newPasskey, data);
  return true;
}

/**
 * Check if a user is blocked
 */
export async function isTorznabUserBlocked(
  passkey: string
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const data = await redis.hget(KEYS.BLOCKED, passkey);
    if (!data) return { blocked: false };

    const entry = JSON.parse(data);
    return { blocked: true, reason: entry.reason };
  } catch (error) {
    console.error('[Torznab Stats] Failed to check user block status:', error);
    return { blocked: false };
  }
}
