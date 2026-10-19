import { and, eq, isNotNull, notExists, notLike } from 'drizzle-orm';

const BATCH = 200;

// Login verifiers used to be stored as is (equivalent to a password for
// anyone reading the database): replace each with its scrypt hash. Runs in
// the background, idempotent, safe on several nodes (conditional updates).
// Rows not converted yet keep working and are converted on their next login.
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'test') return;

  setTimeout(async () => {
    try {
      const { db, schema } = await import('../db');
      const { hashVerifier } = await import('../utils/verifier');
      const { users, panicState } = schema;

      // Encrypted by panic mode: the column holds ciphertext, not verifiers.
      // Checked before every batch, in case panic mode starts meanwhile.
      const encrypted = async () =>
        (await db.select().from(panicState).limit(1))[0]?.isEncrypted ?? false;
      // Also checked by each update: panic mode may commit between the check
      // above and the batch select, which would then read ciphertext.
      const notEncrypted = notExists(
        db.select().from(panicState).where(eq(panicState.isEncrypted, true))
      );

      let converted = 0;
      for (;;) {
        if (await encrypted()) return;
        const rows = await db
          .select({ id: users.id, authVerifier: users.authVerifier })
          .from(users)
          .where(and(isNotNull(users.authVerifier), notLike(users.authVerifier, 'scrypt$%')))
          .limit(BATCH);
        if (rows.length === 0) break;
        for (const row of rows) {
          await db
            .update(users)
            .set({ authVerifier: await hashVerifier(row.authVerifier!) })
            .where(
              and(eq(users.id, row.id), eq(users.authVerifier, row.authVerifier!), notEncrypted)
            );
          converted++;
        }
      }
      if (converted > 0) {
        console.log(`[Security] Hashed ${converted} stored login verifier(s)`);
      }
    } catch (err) {
      console.error('[Security] Verifier hashing failed:', err);
    }
  }, 5000);
});
