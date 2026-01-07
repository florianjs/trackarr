export default defineNitroPlugin(async () => {
  // Initialize tracker when Nitro starts
  // Skip in test mode or if native modules fail to load
  if (process.env.NODE_ENV === 'test') return;

  try {
    // Ensure Redis is connected before tracker accepts requests
    const { connectRedis } = await import('../redis/client');
    await connectRedis();

    const { initTracker } = await import('../tracker');
    initTracker();
  } catch (err) {
    console.warn(
      '[Tracker] Failed to initialize (native modules may not be built):',
      (err as Error).message
    );
    console.warn(
      '[Tracker] Run `pnpm approve-builds` and rebuild to enable tracker'
    );
  }
});
