/**
 * GET /api/auth/passkey
 * Returns the current user's passkey (private, only accessible to the user themselves)
 */
export default defineEventHandler(async (event) => {
  // Read from the DB so a rotated passkey is reflected immediately
  const passkey = await requireUserPasskey(event);

  return { passkey };
});
