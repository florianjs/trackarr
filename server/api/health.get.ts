// Health check endpoint for load balancers and monitoring
import { db } from '../db';
import { redis } from '../redis/client';

export default defineEventHandler(async (event) => {
  const startTime = Date.now();

  const checks: Record<
    string,
    { status: 'ok' | 'error'; latency?: number; error?: string }
  > = {};

  // Check PostgreSQL
  try {
    const dbStart = Date.now();
    await db.execute('SELECT 1');
    checks.postgres = { status: 'ok', latency: Date.now() - dbStart };
  } catch (error) {
    checks.postgres = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redis.ping();
    checks.redis = { status: 'ok', latency: Date.now() - redisStart };
  } catch (error) {
    checks.redis = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  setResponseStatus(event, allHealthy ? 200 : 503);

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    totalLatency: Date.now() - startTime,
    checks,
  };
});
