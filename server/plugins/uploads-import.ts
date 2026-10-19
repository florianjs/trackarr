export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'test') return;

  // Uploads moved from disk to the database: copy existing files once so the
  // other nodes of a replicated deployment can serve them too
  setTimeout(async () => {
    try {
      const { importDiskUploads } = await import('../utils/uploads');
      const imported = await importDiskUploads();
      if (imported > 0) {
        console.log(`[Uploads] Imported ${imported} file(s) from disk into the database`);
      }
    } catch (err) {
      console.error('[Uploads] Disk import failed:', err);
    }
  }, 5000);
});
