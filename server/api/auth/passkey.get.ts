/**
 * GET /api/auth/passkey
 * Returns the current user's passkey (private, only accessible to the user themselves)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  // The passkey is stored in the session, which is only accessible to the authenticated user
  return {
    passkey: user.passkey,
  };
});
