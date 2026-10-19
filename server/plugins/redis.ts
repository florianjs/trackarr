// Connect Redis at startup: the client is lazy and has no offline queue, so
// otherwise the first commands after a start fail while it connects. (The
// old in-process tracker plugin used to do this.)
export default defineNitroPlugin(async () => {
  if (process.env.NODE_ENV === 'test') return;

  try {
    const { connectRedis } = await import('../redis/client');
    await connectRedis();
  } catch (err) {
    // ioredis keeps retrying in the background
    console.error('[Redis] Initial connection failed:', (err as Error).message);
  }
});
