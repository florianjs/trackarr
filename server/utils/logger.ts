import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),

  // Redact sensitive information from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-admin-key"]',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'passkey',
      '*.password',
      '*.passwordHash',
      '*.passkey',
      'REDIS_PASSWORD',
      'DB_PASSWORD',
      'NUXT_SESSION_SECRET',
      'ADMIN_API_KEY',
      'IP_HASH_SECRET',
    ],
    censor: '[REDACTED]',
  },

  // Custom serializers for common objects
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      // Hash IP for privacy
      ip: req.headers?.['x-forwarded-for']
        ? hashForLog(req.headers['x-forwarded-for'])
        : hashForLog(req.socket?.remoteAddress || 'unknown'),
      userAgent: req.headers?.['user-agent'],
      referer: req.headers?.referer,
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
    user: (user: any) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      // Exclude sensitive fields
    }),
  },

  // Pretty print in development
  transport: !isProd
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Production settings
  formatters: isProd
    ? {
        level: (label: string) => {
          return { level: label };
        },
      }
    : undefined,

  timestamp: pino.stdTimeFunctions.isoTime,
});

// Helper to hash IPs for logging (privacy)
function hashForLog(value: string): string {
  if (!value || value === 'unknown') return 'unknown';

  // Use a simple hash for logging (not cryptographic)
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

// Create child loggers for different components
export function createLogger(name: string) {
  return logger.child({ component: name });
}

// Export specific loggers for common components
export const trackerLogger = createLogger('tracker');
export const authLogger = createLogger('auth');
export const apiLogger = createLogger('api');
export const redisLogger = createLogger('redis');
export const dbLogger = createLogger('database');
export const securityLogger = createLogger('security');
