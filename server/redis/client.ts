import Redis, { type RedisOptions } from 'ioredis';
import { readSecret } from '../utils/secrets';

/**
 * Secure Redis Client Configuration
 * Supports authentication, TLS, and connection security with Docker secrets
 */

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isProduction = process.env.NODE_ENV === 'production';

// Parse Redis URL and build secure options
function buildRedisOptions(): RedisOptions {
  // Read Redis password from Docker secret or environment variable
  const redisPassword = readSecret('REDIS_PASSWORD');

  const options: RedisOptions = {
    password: redisPassword,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // Connection security
    enableReadyCheck: true,
    connectTimeout: 10000,
    // Prevent command queue overflow (DDoS protection)
    maxLoadingRetryTime: 5000,
    enableOfflineQueue: false,
    // Key prefix for namespace isolation
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ot:',
  };

  // TLS/SSL configuration for production
  if (process.env.REDIS_TLS === 'true' || redisUrl.startsWith('rediss://')) {
    const tlsConfig: any = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };

    // Support for certificate files (production)
    if (process.env.REDIS_TLS_CA_FILE) {
      try {
        const fs = require('fs');
        tlsConfig.ca = fs.readFileSync(process.env.REDIS_TLS_CA_FILE);

        if (process.env.REDIS_TLS_CERT_FILE) {
          tlsConfig.cert = fs.readFileSync(process.env.REDIS_TLS_CERT_FILE);
        }

        if (process.env.REDIS_TLS_KEY_FILE) {
          tlsConfig.key = fs.readFileSync(process.env.REDIS_TLS_KEY_FILE);
        }

        console.log('[Redis] TLS enabled with certificate files');
      } catch (err: any) {
        console.error('[Redis] Failed to load TLS certificates:', err.message);
      }
    }
    // Support for inline certificate strings (legacy/cloud)
    else if (process.env.REDIS_TLS_CA) {
      tlsConfig.ca = process.env.REDIS_TLS_CA;
    }

    options.tls = tlsConfig;
  }

  // Connection pool limits (prevent resource exhaustion)
  if (isProduction) {
    options.retryStrategy = (times: number) => {
      if (times > 10) {
        console.error('[Redis] Max retries exceeded, giving up');
        return null; // Stop retrying
      }
      // Exponential backoff with max 3 seconds
      return Math.min(times * 200, 3000);
    };
  }

  return options;
}

export const redis = new Redis(redisUrl, buildRedisOptions());

// Connection event handling with security logging
redis.on('connect', () => {
  console.log('[Redis] Connected securely');
});

redis.on('error', (err) => {
  // Sanitize error messages to avoid leaking sensitive info
  const sanitizedMessage = err.message.replace(
    /redis:\/\/[^@]+@/g,
    'redis://***@'
  );
  console.error('[Redis] Error:', sanitizedMessage);
});

redis.on('close', () => {
  console.warn('[Redis] Connection closed');
});

/**
 * Connect to Redis and wait for ready state
 * Must be called before using Redis commands when lazyConnect is enabled
 */
export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready') {
    return;
  }

  if (redis.status === 'connecting') {
    // Already connecting, wait for ready
    return new Promise((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
    });
  }

  await redis.connect();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Redis] Shutting down gracefully...');
  await redis.quit();
});

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Get Redis connection info (sanitized for logging)
 */
export function getRedisInfo(): { connected: boolean; keyPrefix: string } {
  return {
    connected: redis.status === 'ready',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ot:',
  };
}
