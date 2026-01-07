import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Options } from 'postgres';
import * as schema from './schema';

/**
 * Secure PostgreSQL Connection Configuration
 * Supports SSL/TLS, connection pooling, and security hardening
 */

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://tracker:tracker@localhost:5432/opentracker';
const isProduction = process.env.NODE_ENV === 'production';

// Build secure connection options
function buildPostgresOptions(): Options<Record<string, never>> {
  const options: Options<Record<string, never>> = {
    // Connection pool settings (prevent resource exhaustion)
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idle_timeout: 30,
    connect_timeout: 10,

    // Query settings
    prepare: true, // Use prepared statements (SQL injection protection)

    // Transform settings for security
    transform: {
      undefined: null, // Prevent undefined values in queries
    },

    // Connection lifecycle hooks
    onnotice: () => {}, // Suppress notice messages
  };

  // SSL/TLS configuration
  // In Docker internal networks, SSL is typically disabled (DB_SSL=false)
  // For external/cloud databases, enable SSL
  const sslDisabled = process.env.DB_SSL === 'false';
  if (!sslDisabled && (isProduction || process.env.DB_SSL === 'true')) {
    options.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      // Custom CA certificate support
      ...(process.env.DB_SSL_CA && { ca: process.env.DB_SSL_CA }),
    };
  }

  // Debug mode (only in development)
  if (process.env.DB_DEBUG === 'true' && !isProduction) {
    options.debug = (connection, query, params) => {
      // Sanitize params to avoid logging sensitive data
      const sanitizedParams = params?.map((p) =>
        typeof p === 'string' && p.length > 20 ? `${p.slice(0, 10)}...` : p
      );
      console.log('[DB]', query.slice(0, 100), sanitizedParams);
    };
  }

  return options;
}

// Connection for queries (pooled)
const client = postgres(connectionString, buildPostgresOptions());

export const db = drizzle(client, { schema });

export { schema };

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get connection pool stats (for monitoring)
 */
export function getPoolStats(): { max: number; idle_timeout: number } {
  return {
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idle_timeout: 30,
  };
}

/**
 * Graceful shutdown
 */
export async function closeDatabase(): Promise<void> {
  await client.end();
}
