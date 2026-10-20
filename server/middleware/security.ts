/**
 * Security Middleware
 * Centralized security validation for all incoming requests
 * Implements request validation, suspicious activity detection, and security headers
 */

import {
  blacklistIP,
  detectDDoS,
  isBlacklisted,
  getClientIP,
  isNetworkRequest,
} from '../utils/rateLimit';
import { isHoneypotPath } from '../utils/honeypot';
import { SecurityAlertType, sendSecurityAlert } from '../utils/alerts';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { getIpBan } from '../utils/bannedIps';
import { authUserColumns, sessionRejection } from '../utils/adminAuth';
import { buildCsp } from '../utils/csp';
import { checkSession } from '../utils/sessionRules';

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
  // Block path traversal attempts (scanner targets: see honeypot below)
  return !path.includes('..') && !path.includes('//');
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
    // Content Security Policy - pages get a nonce (server/plugins/csp-nonce.ts)
    'Content-Security-Policy': buildCsp(),
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

  // In-process calls ($fetch during SSR) have no socket peer, so every one of
  // them resolves to 'unknown': counted together they trip the DDoS detector
  // and the blacklisted 'unknown' takes every page down. The page request that
  // issued them already went through these checks with the real IP.
  const internal = !isNetworkRequest(event);

  // 1. Check IP Ban (permanent bans, kept in memory)
  if (ip && !internal) {
    const banReason = await getIpBan(ip);
    if (banReason !== undefined) {
      // The reason names the banned user: never show it to whoever shares the IP
      throw createError({
        statusCode: 403,
        message: 'Access denied: IP banned',
      });
    }
  }

  // Check IP blacklist (Temporary rate-limit bans)
  if (!internal && (await isBlacklisted(ip))) {
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

  // Honeypot paths: nobody but a scanner asks for them. Look like any other
  // missing page, alert the admins and block the IP for a while.
  if (isHoneypotPath(path)) {
    console.warn(`[Security] Honeypot path probed: ${path.slice(0, 100)}`);
    void sendSecurityAlert(SecurityAlertType.HONEYPOT_TRIGGERED, {
      title: 'Honeypot path probed',
      description: process.env.HONEYPOT_BAN === 'false'
        ? 'A scanner requested a trap path'
        : 'A scanner requested a trap path: IP temporarily blocked',
      ip,
      endpoint: path.slice(0, 200),
      userAgent: userAgent.slice(0, 200),
    }).catch(() => {});
    if (ip && process.env.HONEYPOT_BAN !== 'false') {
      await blacklistIP(ip, `Honeypot: ${path.slice(0, 100)}`, 0, false);
    }
    throw createError({ statusCode: 404, message: 'Page not found' });
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
    if (!internal) await detectDDoS(event);
  }

  // Rate limit check for tracker endpoints (high volume)
  if (!internal && (path.includes('/announce') || path.includes('/scrape'))) {
    await detectDDoS(event);
  }

  // 2. Check User Ban and session revocation (for authenticated sessions)
  // Skip for auth routes and Torznab API (has its own passkey auth)
  if (!path.startsWith('/api/auth/') && !path.startsWith('/api/torznab')) {
    const session = await getUserSession(event);

    if (session.user) {
      // Check DB for ban status
      const [dbUser] = await db
        .select(authUserColumns)
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      // Banned, or revoked: session_version bumped since the cookie was
      // issued (ban, sign out everywhere). Read on every request, so
      // revocation applies at once on every node.
      const check = checkSession(session.sessionVersion, dbUser);
      if (check !== 'valid') {
        // Clear session immediately
        await clearUserSession(event);

        // API requests fail (403 banned, 401 revoked); pages render signed out
        if (path.startsWith('/api/')) {
          throw sessionRejection(check);
        }
      } else {
        // Cache DB state to avoid redundant queries in requireAuthSession
        event.context.authUser = dbUser;
      }
    }
  }
});
