/**
 * Admin Authentication Middleware
 * Protects admin routes with API key or session validation
 */

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

/**
 * Check if the request has valid admin authentication
 * Supports:
 * - X-Admin-Key header
 * - Authorization: Bearer <key> header
 */
export function requireAdmin(event: any): void {
  // Check for admin API key
  const apiKey =
    getHeader(event, 'x-admin-key') ||
    getHeader(event, 'authorization')?.replace('Bearer ', '');

  if (!ADMIN_API_KEY) {
    // No API key configured - only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw createError({
        statusCode: 503,
        message: 'Admin API not configured',
      });
    }
    // In dev mode, allow without key but log warning
    console.warn(
      '[Security] Admin endpoint accessed without ADMIN_API_KEY configured'
    );
    return;
  }

  if (!apiKey) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!secureCompare(apiKey, ADMIN_API_KEY)) {
    throw createError({
      statusCode: 403,
      message: 'Invalid credentials',
    });
  }
}

/**
 * Optional admin check - returns boolean instead of throwing
 */
export function isAdmin(event: any): boolean {
  try {
    requireAdmin(event);
    return true;
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
