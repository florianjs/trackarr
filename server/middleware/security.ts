/**
 * Security Middleware
 * Centralized security validation for all incoming requests
 * Implements request validation, suspicious activity detection, and security headers
 */

import { detectDDoS, isBlacklisted, getClientIP } from '../utils/rateLimit';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, bannedIps } from '../db/schema';

// ============================================================================
// Security Configuration
// ============================================================================

const SUSPICIOUS_PATTERNS = [
  // SQL Injection patterns
  /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b.*\bwhere\b)/i,
  /(\bdrop\b.*\btable\b|\bdelete\b.*\bfrom\b)/i,
  /('|"|;|--|\bor\b.*=.*\bor\b)/i,

  // XSS patterns
  /<script[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i,

  // Path traversal
  /\.\.\//,
  /\.\.%2f/i,

  // Common attack tools
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
];

const BLOCKED_USER_AGENTS = [
  'sqlmap',
  'nikto',
  'masscan',
  'nmap',
  'zgrab',
  'dirbuster',
  'gobuster',
  'wfuzz',
  'hydra',
];

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Check for suspicious patterns in request
 */
function hasSuspiciousPatterns(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for blocked user agents
 */
function hasBlockedUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BLOCKED_USER_AGENTS.some((blocked) => ua.includes(blocked));
}

/**
 * Validate request path
 */
function isValidPath(path: string): boolean {
  // Block path traversal attempts
  if (path.includes('..')) return false;
  if (path.includes('//')) return false;

  // Block sensitive paths
  const blockedPaths = [
    '/etc/',
    '/proc/',
    '/sys/',
    '/.env',
    '/.git',
    '/wp-admin',
    '/phpmyadmin',
    '/admin.php',
  ];

  return !blockedPaths.some((blocked) => path.toLowerCase().includes(blocked));
}

/**
 * Validate query parameters
 */
function validateQueryParams(query: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      if (hasSuspiciousPatterns(value)) return false;
      if (value.length > 10000) return false; // Prevent oversized params
    }
    if (hasSuspiciousPatterns(key)) return false;
  }
  return true;
}

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Apply security headers to response
 */
function applySecurityHeaders(event: any): void {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-DNS-Prefetch-Control': 'off',
    // Content Security Policy - Strict security rules
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Nuxt requires unsafe-inline for HMR
      "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
  };

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    headers['Strict-Transport-Security'] =
      'max-age=31536000; includeSubDomains; preload';
  }

  for (const [key, value] of Object.entries(headers)) {
    setHeader(event, key, value);
  }
}

// ============================================================================
// Main Security Middleware
// ============================================================================

export default defineEventHandler(async (event) => {
  const path = event.path || '';
  const method = event.method;

  // Skip security checks for static assets
  if (path.startsWith('/_nuxt/') || path.startsWith('/favicon')) {
    return;
  }

  // Apply security headers
  applySecurityHeaders(event);

  // Get client info
  const ip = getClientIP(event);
  const userAgent = getHeader(event, 'user-agent') || '';

  // 1. Check IP Ban (Permanent bans from DB)
  if (ip) {
    const [bannedIp] = await db
      .select()
      .from(bannedIps)
      .where(eq(bannedIps.ip, ip))
      .limit(1);

    if (bannedIp) {
      throw createError({
        statusCode: 403,
        message: `Access denied: ${bannedIp.reason || 'IP banned'}`,
      });
    }
  }

  // Check IP blacklist (Temporary rate-limit bans)
  if (await isBlacklisted(ip)) {
    console.warn(`[Security] Blocked blacklisted IP: ${ip.slice(0, 8)}...`);
    throw createError({
      statusCode: 403,
      message: 'Access denied',
    });
  }

  // Check for blocked user agents
  if (hasBlockedUserAgent(userAgent)) {
    console.warn(
      `[Security] Blocked suspicious user agent: ${userAgent.slice(0, 50)}...`
    );
    throw createError({
      statusCode: 403,
      message: 'Access denied',
    });
  }

  // Validate request path
  if (!isValidPath(path)) {
    console.warn(`[Security] Blocked suspicious path: ${path}`);
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
    });
  }

  // Validate query parameters for API routes
  if (path.startsWith('/api/')) {
    const query = getQuery(event) as Record<string, unknown>;
    if (!validateQueryParams(query)) {
      console.warn(`[Security] Blocked suspicious query params on ${path}`);
      throw createError({
        statusCode: 400,
        message: 'Invalid request parameters',
      });
    }

    // DDoS detection for API routes
    await detectDDoS(event);
  }

  // Rate limit check for tracker endpoints (high volume)
  if (path.includes('/announce') || path.includes('/scrape')) {
    await detectDDoS(event);
  }

  // 2. Check User Ban (for authenticated sessions)
  // Skip for auth routes to avoid blocking login/logout
  if (!path.startsWith('/api/auth/')) {
    const session = await getUserSession(event);

    if (session.user) {
      // Check DB for ban status
      const [dbUser] = await db
        .select({ isBanned: users.isBanned })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (dbUser?.isBanned) {
        // Clear session immediately
        await clearUserSession(event);

        // If it's an API request, throw 403
        if (path.startsWith('/api/')) {
          throw createError({
            statusCode: 403,
            message: 'Your account has been banned',
          });
        }
      }

      // Mark as checked to avoid redundant DB queries in requireAuthSession
      event.context.authChecked = true;
    }
  }
});
