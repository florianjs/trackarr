/**
 * Advanced Rate Limiting & DDoS Protection
 * Uses Redis for distributed rate limiting across instances
 * Implements sliding window, IP blacklisting, and progressive penalties
 */

import { redis } from '../redis/client';

// ============================================================================
// Types & Configuration
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface BlacklistEntry {
  reason: string;
  expiresAt: number;
  violations: number;
}

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, RateLimitEntry>();
const memoryBlacklist = new Map<string, BlacklistEntry>();

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) {
        memoryStore.delete(key);
      }
    }
    for (const [key, entry] of memoryBlacklist.entries()) {
      if (entry.expiresAt < now) {
        memoryBlacklist.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

export interface RateLimitOptions {
  /** Time window in seconds */
  windowSec: number;
  /** Max requests per window */
  maxRequests: number;
  /** Key prefix for different rate limit contexts */
  prefix?: string;
  /** Use Redis for distributed limiting (default: true) */
  useRedis?: boolean;
  /** Enable progressive penalties (default: false) */
  progressive?: boolean;
}

// ============================================================================
// IP Utilities
// ============================================================================

/**
 * Extract client IP with proxy support
 */
export function getClientIP(event: any): string {
  // Check trusted proxy headers
  const cfConnectingIP = getHeader(event, 'cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  const realIP = getHeader(event, 'x-real-ip');
  if (realIP) return realIP;

  const forwarded = getHeader(event, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  // Fallback to direct connection IP
  return event.node?.req?.socket?.remoteAddress || 'unknown';
}

/**
 * Normalize IP address (handle IPv6-mapped IPv4)
 */
function normalizeIP(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip;
}

// ============================================================================
// Blacklist Management
// ============================================================================

const BLACKLIST_KEY = 'ddos:blacklist';
const BLACKLIST_DURATION_BASE = 300; // 5 minutes base
const MAX_BLACKLIST_DURATION = 86400; // 24 hours max

/**
 * Check if an IP is blacklisted
 */
export async function isBlacklisted(ip: string): Promise<boolean> {
  const normalizedIP = normalizeIP(ip);

  try {
    const data = await redis.hget(BLACKLIST_KEY, normalizedIP);
    if (!data) return false;

    const entry: BlacklistEntry = JSON.parse(data);
    if (entry.expiresAt < Date.now()) {
      await redis.hdel(BLACKLIST_KEY, normalizedIP);
      return false;
    }
    return true;
  } catch {
    // Fallback to memory
    const entry = memoryBlacklist.get(normalizedIP);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      memoryBlacklist.delete(normalizedIP);
      return false;
    }
    return true;
  }
}

/**
 * Add IP to blacklist with progressive duration
 */
export async function blacklistIP(
  ip: string,
  reason: string,
  previousViolations: number = 0
): Promise<void> {
  const normalizedIP = normalizeIP(ip);
  const violations = previousViolations + 1;

  // Progressive penalty: doubles each time, up to max
  const duration =
    Math.min(
      BLACKLIST_DURATION_BASE * Math.pow(2, violations - 1),
      MAX_BLACKLIST_DURATION
    ) * 1000;

  const entry: BlacklistEntry = {
    reason,
    expiresAt: Date.now() + duration,
    violations,
  };

  console.warn(
    `[DDoS] Blacklisting IP ${normalizedIP.slice(0, 8)}... for ${duration / 1000}s. Reason: ${reason}`
  );

  try {
    await redis.hset(BLACKLIST_KEY, normalizedIP, JSON.stringify(entry));
    await redis.expire(BLACKLIST_KEY, MAX_BLACKLIST_DURATION);
  } catch {
    memoryBlacklist.set(normalizedIP, entry);
  }
}

/**
 * Get violation count for an IP
 */
async function getViolationCount(ip: string): Promise<number> {
  const normalizedIP = normalizeIP(ip);

  try {
    const data = await redis.hget(BLACKLIST_KEY, normalizedIP);
    if (!data) return 0;
    const entry: BlacklistEntry = JSON.parse(data);
    return entry.violations;
  } catch {
    const entry = memoryBlacklist.get(normalizedIP);
    return entry?.violations || 0;
  }
}

// ============================================================================
// Rate Limiting (Redis-backed with memory fallback)
// ============================================================================

/**
 * Rate limit using Redis sliding window
 */
async function rateLimitRedis(
  key: string,
  windowSec: number,
  maxRequests: number
): Promise<{ remaining: number; blocked: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = now - windowMs;

  // Use sorted set for sliding window
  const redisKey = `ratelimit:${key}`;

  try {
    // Remove old entries and add current request atomically
    const multi = redis.multi();
    multi.zremrangebyscore(redisKey, 0, windowStart);
    multi.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);
    multi.zcard(redisKey);
    multi.expire(redisKey, windowSec + 1);

    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) || 0;

    if (count > maxRequests) {
      // Calculate retry after based on oldest request in window
      const oldestResult = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const oldestTime =
        oldestResult.length >= 2 ? parseInt(oldestResult[1]) : now;
      const retryAfter = Math.ceil((oldestTime + windowMs - now) / 1000);

      return {
        remaining: 0,
        blocked: true,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return { remaining: maxRequests - count, blocked: false };
  } catch (err) {
    console.warn(
      '[RateLimit] Redis error, falling back to memory:',
      (err as Error).message
    );
    return rateLimitMemory(key, windowSec, maxRequests);
  }
}

/**
 * Rate limit using in-memory store (fallback)
 */
function rateLimitMemory(
  key: string,
  windowSec: number,
  maxRequests: number
): { remaining: number; blocked: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = windowSec * 1000;

  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { remaining: maxRequests - 1, blocked: false };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { remaining: 0, blocked: true, retryAfter };
  }

  entry.count++;
  return { remaining: maxRequests - entry.count, blocked: false };
}

// ============================================================================
// Main Rate Limit Function
// ============================================================================

/**
 * Check and apply rate limit
 * Returns remaining requests or throws 429 error
 */
export async function rateLimit(
  event: any,
  options: RateLimitOptions
): Promise<number> {
  const {
    windowSec,
    maxRequests,
    prefix = 'rl',
    useRedis = true,
    progressive = false,
  } = options;

  const ip = getClientIP(event);
  const normalizedIP = normalizeIP(ip);

  // Check blacklist first
  if (await isBlacklisted(normalizedIP)) {
    throw createError({
      statusCode: 403,
      message: 'Access temporarily blocked',
    });
  }

  const key = `${prefix}:${normalizedIP}`;

  const result = useRedis
    ? await rateLimitRedis(key, windowSec, maxRequests)
    : rateLimitMemory(key, windowSec, maxRequests);

  if (result.blocked) {
    // Progressive penalty: blacklist after multiple rate limit violations
    if (progressive) {
      const violations = await getViolationCount(normalizedIP);
      if (violations >= 3) {
        await blacklistIP(
          normalizedIP,
          'Repeated rate limit violations',
          violations
        );
      } else {
        await blacklistIP(normalizedIP, 'Rate limit exceeded', violations);
      }
    }

    throw createError({
      statusCode: 429,
      message: 'Too many requests',
      data: { retryAfter: result.retryAfter },
    });
  }

  return result.remaining;
}

// ============================================================================
// DDoS Detection
// ============================================================================

const DDOS_DETECTION_WINDOW = 10; // 10 seconds
const DDOS_THRESHOLD = 100; // 100 requests in 10 seconds = attack

/**
 * Check for DDoS patterns and auto-blacklist
 */
export async function detectDDoS(event: any): Promise<void> {
  const ip = getClientIP(event);
  const normalizedIP = normalizeIP(ip);

  if (await isBlacklisted(normalizedIP)) {
    throw createError({
      statusCode: 403,
      message: 'Access temporarily blocked',
    });
  }

  const key = `ddos:detect:${normalizedIP}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, DDOS_DETECTION_WINDOW);
    }

    if (count > DDOS_THRESHOLD) {
      const violations = await getViolationCount(normalizedIP);
      await blacklistIP(normalizedIP, 'DDoS pattern detected', violations);
      throw createError({
        statusCode: 403,
        message: 'Access temporarily blocked',
      });
    }
  } catch (err) {
    if ((err as any).statusCode === 403) throw err;
    // Redis error, continue without DDoS detection
  }
}

// ============================================================================
// Rate Limit Presets
// ============================================================================

/**
 * Default rate limit configs for different endpoint types
 */
export const RATE_LIMITS = {
  // Public read endpoints - generous limits
  public: { windowSec: 60, maxRequests: 100, prefix: 'pub', progressive: true },

  // Upload/mutation endpoints - stricter
  mutation: {
    windowSec: 60,
    maxRequests: 10,
    prefix: 'mut',
    progressive: true,
  },

  // Admin endpoints - moderate
  admin: { windowSec: 60, maxRequests: 30, prefix: 'adm' },

  // Tracker announce - very generous (clients announce frequently)
  tracker: {
    windowSec: 60,
    maxRequests: 200,
    prefix: 'trk',
    progressive: true,
  },

  // Auth endpoints - strict to prevent brute force
  auth: { windowSec: 300, maxRequests: 5, prefix: 'auth', progressive: true },

  // Search - moderate
  search: { windowSec: 60, maxRequests: 30, prefix: 'search' },

  // Download - moderate
  download: { windowSec: 60, maxRequests: 20, prefix: 'dl' },
};

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * Apply rate limit with DDoS detection
 */
export async function protectEndpoint(
  event: any,
  limitType: keyof typeof RATE_LIMITS
): Promise<number> {
  await detectDDoS(event);
  return rateLimit(event, RATE_LIMITS[limitType]);
}
