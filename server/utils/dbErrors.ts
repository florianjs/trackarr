/**
 * Postgres unique-constraint violation (23505). Drizzle wraps driver errors
 * in DrizzleQueryError and keeps the postgres-js error in `cause`.
 */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 3; depth++) {
    if ((e as { code?: unknown }).code === '23505') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
