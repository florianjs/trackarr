/**
 * POST /api/auth/logout
 * Destroy current session
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event);

  return {
    success: true,
  };
});
